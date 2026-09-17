import pg from "pg";
import "./resolve-hooks.mjs";
import { createHmac, randomUUID, randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export const BASE = process.env.TEST_BASE_URL ?? "http://localhost:3000";

const connectionString =
  process.env.DATABASE_URL ??
  (() => {
    // Mirror what the app reads, so the tests always talk to the same database.
    // `.env.development.local` is where local config lives: Next loads it in
    // development but not during a production build, which keeps it out of the
    // `.env.local` stays supported for old checkouts.
    for (const name of [".env.development.local", ".env.local"]) {
      const file = path.join(process.cwd(), name);
      if (!fs.existsSync(file)) continue;
      const found = fs.readFileSync(file, "utf8").match(/^DATABASE_URL=(.+)$/m)?.[1]?.trim();
      if (found) return found;
    }
    return undefined;
  })();

/** Exposed so a test can hand the same database to the app's own modules. */
export const CONNECTION_STRING = connectionString;

const pool = new pg.Pool({
  connectionString,
  ssl: connectionString?.includes("supabase") ? { rejectUnauthorized: false } : undefined,
  max: 3,
});

const positional = (sql) => {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
};

/** Mirrors the shape the tests used against SQLite, so the assertions did not change. */
export const db = () => ({
  prepare(sql) {
    const text = positional(sql);
    return {
      async get(...args) {
        return (await pool.query(text, args)).rows[0];
      },
      async all(...args) {
        return (await pool.query(text, args)).rows;
      },
      async run(...args) {
        await pool.query(text, args);
      },
    };
  },
  close() {},
});

export const closePool = () => pool.end();

/**
 * Signs a session cookie exactly the way the app does, so the tests exercise the
 * real authorization paths instead of a stand-in for them.
 */
function secret() {
  if (process.env.AUTH_SECRET && process.env.AUTH_SECRET.length >= 32) return process.env.AUTH_SECRET;
  return fs.readFileSync(path.join(process.cwd(), "data", ".dev-session-secret"), "utf8").trim();
}

export async function sessionFor(email) {
  const connection = db();
  const user = await connection.prepare("SELECT id FROM users WHERE email = ?").get(email);
  if (!user) throw new Error(`No such user: ${email}`);

  const id = randomUUID().replace(/-/g, "") + randomBytes(8).toString("hex");
  const ts = Date.now();
  await connection
    .prepare("INSERT INTO sessions (id, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)")
    .run(id, user.id, ts, ts + 3_600_000);

  const mac = createHmac("sha256", secret()).update(id).digest("hex");
  return `dk_session=${id}.${mac}`;
}

/**
 * In development the first request to a route compiles it, which can take longer
 * than a test's patience — especially if a build is running on the same machine.
 * One warm-up before the suite keeps that cost out of the assertions.
 */
let warmed;
async function warmUp() {
  warmed ??= (async () => {
    for (let attempt = 0; attempt < 30; attempt++) {
      try {
        const response = await fetch(`${BASE}/`, { cache: "no-store" });
        if (response.ok) return;
      } catch {
        /* server still starting */
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    throw new Error(`No server answering at ${BASE}. Start it with: npm run dev`);
  })();
  return warmed;
}

/** What the app sees from a real visitor; anything else is classified as a bot. */
export const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36";

/**
 * Visits as a returning visitor by default — one who has already chosen a
 * language — because a first-time visitor is shown the language gate instead of
 * the page. Pass `locale: null` to arrive as someone brand new.
 */
export async function visit(
  pathname,
  { cookie, redirect = "manual", userAgent = BROWSER_UA, locale = "ar" } = {},
) {
  await warmUp();

  const jar = [locale ? `dk_locale=${locale}` : null, cookie].filter(Boolean).join("; ");

  const response = await fetch(`${BASE}${pathname}`, {
    headers: { "user-agent": userAgent, ...(jar ? { cookie: jar } : {}) },
    redirect,
    cache: "no-store",
  });
  const body = await response.text();
  return { status: response.status, body, headers: response.headers, url: response.url };
}

/**
 * Next answers a mid-stream `redirect()` with a 200 whose payload carries the
 * destination, so "was this blocked?" means checking both.
 */
export function redirectedTo(result) {
  if (result.status >= 300 && result.status < 400) return result.headers.get("location");
  const match = result.body.match(/"(?:RSC_)?redirect"?[,:]\s*"([^"]+)"/) ??
    result.body.match(/\\"([^"\\]*\/(?:login|dashboard|console)[^"\\]*)\\"/);
  return match ? match[1] : null;
}

export const contains = (result, needle) => result.body.includes(needle);
