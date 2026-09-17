import "server-only";
import { all, get, now, run } from "./db";
import { newId } from "./ids";
import { randomBytes } from "node:crypto";
import { TenantError, assertCanEdit } from "./portfolios";
import { messages } from "./locale";
import type { User } from "./types";

export interface Domain {
  id: string;
  portfolio_id: string;
  hostname: string;
  status: "pending" | "active" | "failed";
  verify_token: string;
  last_error: string;
  checked_at: number | null;
  verified_at: number | null;
  created_at: number;
  updated_at: number;
}

/** The TXT record name a customer adds, under their own domain. */
export const TXT_RECORD = "_designakum";

/**
 * Hostnames the platform answers to itself.
 *
 * A customer must never be able to claim one of these: pointing "designakum.sa"
 * at a portfolio would take over the platform's own pages. Anything here is
 * refused, as is anything under them.
 */
function reservedHosts(): string[] {
  const configured = [process.env.SITE_URL, process.env.URL, process.env.DEPLOY_URL]
    .filter(Boolean)
    .map((value) => {
      try {
        return new URL(value!).hostname.toLowerCase();
      } catch {
        return null;
      }
    })
    .filter((value): value is string => Boolean(value));

  return [...new Set([...configured, "localhost", "designakum.sa", "designakum.com"])];
}

/** True when this request's host belongs to the platform rather than a customer. */
export function isPlatformHost(hostname: string): boolean {
  const host = normaliseHost(hostname);
  return reservedHosts().some((reserved) => host === reserved || host.endsWith(`.${reserved}`));
}

export function normaliseHost(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/:\d+$/, "")
    .replace(/\.$/, "");
}

/**
 * A hostname we are willing to serve.
 *
 * Deliberately strict: labels of letters, digits and hyphens, at least two of
 * them, and a real TLD. Anything looser and the middleware ends up trying to
 * resolve garbage on every request to an unknown host.
 */
const HOSTNAME = /^(?!-)[a-z0-9-]{1,63}(?<!-)(\.(?!-)[a-z0-9-]{1,63}(?<!-))+$/;

export function hostnameProblem(hostname: string): "invalid" | "reserved" | null {
  if (!HOSTNAME.test(hostname) || hostname.length > 253) return "invalid";
  if (isPlatformHost(hostname)) return "reserved";
  return null;
}

export async function domainsFor(portfolioId: string): Promise<Domain[]> {
  return await all<Domain>(
    "SELECT * FROM domains WHERE portfolio_id = ? ORDER BY created_at",
    portfolioId,
  );
}

/** The portfolio a live custom hostname points at, or null. */
export async function portfolioIdForHost(hostname: string): Promise<string | null> {
  const row = await get<{ portfolio_id: string }>(
    "SELECT portfolio_id FROM domains WHERE hostname = ? AND status = 'active'",
    normaliseHost(hostname),
  );
  return row?.portfolio_id ?? null;
}

export async function addDomain(portfolioId: string, user: User, input: string): Promise<Domain> {
  await assertCanEdit(portfolioId, user);
  const hostname = normaliseHost(input);
  const m = await messages();

  const problem = hostnameProblem(hostname);
  if (problem === "invalid") throw new TenantError(m.domainInvalid);
  if (problem === "reserved") throw new TenantError(m.domainReserved);

  const existing = await get<Domain>("SELECT * FROM domains WHERE hostname = ?", hostname);
  if (existing) {
    // Their own name, re-added: hand back the row rather than an error.
    if (existing.portfolio_id === portfolioId) return existing;
    throw new TenantError(m.domainTaken);
  }

  const ts = now();
  const domain: Domain = {
    id: newId("dom"),
    portfolio_id: portfolioId,
    hostname,
    status: "pending",
    verify_token: `dk-verify-${randomBytes(16).toString("hex")}`,
    last_error: "",
    checked_at: null,
    verified_at: null,
    created_at: ts,
    updated_at: ts,
  };

  await run(
    `INSERT INTO domains (id, portfolio_id, hostname, status, verify_token, created_at, updated_at)
     VALUES (?, ?, ?, 'pending', ?, ?, ?)`,
    domain.id,
    domain.portfolio_id,
    domain.hostname,
    domain.verify_token,
    ts,
    ts,
  );
  return domain;
}

export async function removeDomain(domainId: string, user: User) {
  const domain = await get<Domain>("SELECT * FROM domains WHERE id = ?", domainId);
  if (!domain) return;
  await assertCanEdit(domain.portfolio_id, user);
  await run("DELETE FROM domains WHERE id = ?", domainId);
}

/* ------------------------------------------------------------------ checking */

/**
 * DNS over HTTPS rather than `node:dns`.
 *
 * The resolver a server happens to have is not the one the rest of the world
 * uses, and more to the point Workers has no `node:dns` at all — this is the
 * lookup that keeps working when the platform moves to Cloudflare, and it works
 * identically on Node today.
 */
async function resolve(name: string, type: "TXT" | "CNAME" | "A"): Promise<string[]> {
  const response = await fetch(
    `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=${type}`,
    { headers: { accept: "application/dns-json" }, cache: "no-store" },
  );
  if (!response.ok) throw new Error(`DNS lookup failed (${response.status})`);

  const body = (await response.json()) as { Answer?: { type: number; data: string }[] };
  return (body.Answer ?? [])
    .map((answer) => answer.data.replace(/^"|"$/g, "").replace(/\.$/, "").toLowerCase())
    .filter(Boolean);
}

export interface CheckResult {
  ok: boolean;
  /** A key into the `messages` dictionary, so it can be shown in either language. */
  reason?: "domainNoTxt" | "domainNotPointed" | "domainLookupFailed";
}

/**
 * Does this name reach us, by either of the two legal ways of pointing it here?
 *
 * A subdomain uses a CNAME. A root domain cannot: RFC 1034 reserves the zone
 * apex for SOA and NS records, and a CNAME may not sit beside other records at
 * the same name, so registrars refuse to create one. A root domain therefore
 * points at our addresses with an A record instead.
 *
 * The platform's own addresses are looked up rather than written down, so this
 * keeps working when the host changes an IP, which they do without telling
 * anybody.
 */
export function pointsHere(
  cname: string[],
  a: string[],
  target: string,
  platformAddresses: string[],
): boolean {
  if (cname.includes(normaliseHost(target))) return true;
  return a.length > 0 && a.some((address) => platformAddresses.includes(address));
}

/**
 * Two questions, answered by different records.
 *
 * The TXT record proves the customer controls the name. The CNAME or the A
 * records are what make the name actually reach us. A domain with only the TXT
 * is verified but dark; a domain pointed here without the TXT is somebody
 * aiming a name they may not own.
 */
export async function checkDomain(domain: Domain, target: string): Promise<CheckResult> {
  let txt: string[];
  let cname: string[];
  let a: string[];
  let platformAddresses: string[];
  try {
    [txt, cname, a, platformAddresses] = await Promise.all([
      resolve(`${TXT_RECORD}.${domain.hostname}`, "TXT"),
      resolve(domain.hostname, "CNAME"),
      resolve(domain.hostname, "A"),
      resolve(normaliseHost(target), "A"),
    ]);
  } catch {
    return { ok: false, reason: "domainLookupFailed" };
  }

  if (!txt.includes(domain.verify_token.toLowerCase())) {
    return { ok: false, reason: "domainNoTxt" };
  }
  if (!pointsHere(cname, a, target, platformAddresses)) {
    return { ok: false, reason: "domainNotPointed" };
  }
  return { ok: true };
}

/** The addresses a root domain should point at. Shown to the customer. */
export async function platformAddresses(target: string): Promise<string[]> {
  try {
    return await resolve(normaliseHost(target), "A");
  } catch {
    return [];
  }
}

export async function recordCheck(domain: Domain, result: CheckResult, error: string) {
  const ts = now();
  await run(
    `UPDATE domains SET status = ?, last_error = ?, checked_at = ?,
       verified_at = COALESCE(verified_at, ?), updated_at = ?
     WHERE id = ?`,
    result.ok ? "active" : "failed",
    result.ok ? "" : error,
    ts,
    result.ok ? ts : null,
    ts,
    domain.id,
  );
}

/**
 * Every customer domain on the platform, for staff.
 *
 * Exists because attaching a domain to the hosting account is a step the app
 * cannot take on its own without holding a credential that can delete the
 * platform. Staff do it, so staff need to see which domains are waiting.
 */
export async function allDomains(): Promise<
  (Domain & { slug: string; email: string })[]
> {
  return await all<Domain & { slug: string; email: string }>(
    `SELECT d.*, p.slug, u.email
       FROM domains d
       JOIN portfolios p ON p.id = d.portfolio_id
       JOIN users u ON u.id = p.user_id
      ORDER BY d.created_at DESC
      LIMIT 200`,
  );
}
