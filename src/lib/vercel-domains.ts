import "server-only";
import { recordError } from "./error-log";

/**
 * Telling the host about a customer's domain.
 *
 * The domain feature had a hole worth naming plainly: the app checked the
 * customer's DNS and recorded the domain, and nothing ever told Vercel to serve
 * that hostname. DNS pointed at the platform, the platform answered 404, and
 * the customer had done everything the screen asked. Somebody had to open the
 * Vercel dashboard by hand for every domain sold, which is fine at one customer
 * and a support queue at twenty.
 *
 * This closes it, and stays optional. With no credentials configured it reports
 * that it did nothing, the domain is still recorded, verification still works,
 * and the platform behaves exactly as it did before. That matters because the
 * token this needs is a real credential, and the platform should not stop
 * working the day it is rotated.
 */

export interface HostResult {
  /** False when the hostname is not, in fact, ready to be served. */
  ok: boolean;
  /** What happened, for the audit log and for staff reading the console. */
  detail: "added" | "already-there" | "not-configured" | "taken" | "refused" | "unreachable";
}

export const hostConfigured = () =>
  Boolean(process.env.VERCEL_TOKEN && process.env.VERCEL_PROJECT_ID);

function endpoint(path: string): string {
  const team = process.env.VERCEL_TEAM_ID;
  return `https://api.vercel.com${path}${team ? `?teamId=${encodeURIComponent(team)}` : ""}`;
}

/**
 * What an answer from the host means for us.
 *
 * Pure, because these are the cases that matter and none of them are reachable
 * from a test that has to make a real request. The interesting one is 409: a
 * domain already attached to this project is a success, and the same status
 * covers a domain held by somebody else's account, which is a failure the
 * customer has to resolve themselves.
 */
export function readAttach(status: number, body: unknown): HostResult {
  if (status >= 200 && status < 300) return { ok: true, detail: "added" };

  const code = (body as { error?: { code?: string } } | null)?.error?.code ?? "";

  if (code === "domain_already_in_use_by_this_project" || code === "domain_already_exists") {
    return { ok: true, detail: "already-there" };
  }
  if (status === 409 || code.startsWith("domain_already_in_use")) {
    return { ok: false, detail: "taken" };
  }
  return { ok: false, detail: "refused" };
}

export async function attachDomain(hostname: string): Promise<HostResult> {
  if (!hostConfigured()) return { ok: false, detail: "not-configured" };

  try {
    const response = await fetch(
      endpoint(`/v10/projects/${encodeURIComponent(process.env.VERCEL_PROJECT_ID!)}/domains`),
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.VERCEL_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: hostname }),
        signal: AbortSignal.timeout(8000),
      },
    );

    const body = await response.json().catch(() => null);
    const result = readAttach(response.status, body);

    if (!result.ok) {
      await recordError({
        area: "domains.attach",
        message: `Host refused ${hostname}: ${response.status} ${result.detail}`,
        context: { hostname, status: response.status },
      });
    }
    return result;
  } catch (error) {
    // The domain is already recorded by the time we get here, so a host that is
    // unreachable delays the customer rather than losing their work.
    await recordError({
      area: "domains.attach",
      message: `Could not reach the host for ${hostname}: ${(error as Error).message}`,
      context: { hostname },
    });
    return { ok: false, detail: "unreachable" };
  }
}

/**
 * Removing it again, so a domain released here is released everywhere.
 *
 * Without this a customer who removes a domain leaves it claimed on the
 * platform's hosting account, where it silently blocks anyone else — including
 * themselves on a second attempt — from ever adding it again.
 */
export async function detachDomain(hostname: string): Promise<HostResult> {
  if (!hostConfigured()) return { ok: false, detail: "not-configured" };

  try {
    const response = await fetch(
      endpoint(
        `/v9/projects/${encodeURIComponent(process.env.VERCEL_PROJECT_ID!)}/domains/${encodeURIComponent(hostname)}`,
      ),
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${process.env.VERCEL_TOKEN}` },
        signal: AbortSignal.timeout(8000),
      },
    );

    // Already gone is the outcome we wanted.
    if (response.ok || response.status === 404) return { ok: true, detail: "added" };
    return { ok: false, detail: "refused" };
  } catch {
    return { ok: false, detail: "unreachable" };
  }
}
