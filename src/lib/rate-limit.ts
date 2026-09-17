import "server-only";
import { headers } from "next/headers";
import { createHash } from "node:crypto";
import { get, now, run } from "./db";

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

/**
 * Fixed-window counter kept in the database. Good enough for the abuse this app sees
 * (login guessing, report and ticket spam) and it survives a restart, which an
 * in-memory map would not.
 */
export async function rateLimit(key: string, limit: number, windowMs: number): Promise<RateLimitResult>{
  const ts = now();
  const row = await get<{ window_start: number; count: number }>(
    "SELECT window_start, count FROM rate_limits WHERE key = ?",
    key,
  );

  if (!row || ts - row.window_start >= windowMs) {
    await run(
      `INSERT INTO rate_limits (key, window_start, count) VALUES (?, ?, 1)
       ON CONFLICT(key) DO UPDATE SET window_start = excluded.window_start, count = 1`,
      key,
      ts,
    );
    return { ok: true, remaining: limit - 1, retryAfterSeconds: 0 };
  }

  if (row.count >= limit) {
    return {
      ok: false,
      remaining: 0,
      retryAfterSeconds: Math.ceil((row.window_start + windowMs - ts) / 1000),
    };
  }

  await run("UPDATE rate_limits SET count = count + 1 WHERE key = ?", key);
  return { ok: true, remaining: limit - row.count - 1, retryAfterSeconds: 0 };
}

/**
 * The same window, claimed atomically.
 *
 * `rateLimit` reads and then writes, which is fine for the things it was built
 * for — login attempts and ticket spam arrive as separate requests and mostly
 * queue behind each other. It is not fine for callers that fire at once: twenty
 * concurrent claims all read the same low count and all believe they are under
 * the limit. This does the read and the write in one statement, so the database
 * decides the order rather than the race.
 */
export async function claimSlot(key: string, limit: number, windowMs: number): Promise<boolean> {
  const ts = now();
  const cutoff = ts - windowMs;

  const row = await get<{ count: number }>(
    `INSERT INTO rate_limits (key, window_start, count) VALUES (?, ?, 1)
     ON CONFLICT(key) DO UPDATE SET
       window_start = CASE WHEN rate_limits.window_start <= ? THEN ? ELSE rate_limits.window_start END,
       count        = CASE WHEN rate_limits.window_start <= ? THEN 1 ELSE rate_limits.count + 1 END
     RETURNING count`,
    key,
    ts,
    cutoff,
    ts,
    cutoff,
  );

  return (row?.count ?? limit + 1) <= limit;
}

/** A coarse, non-identifying fingerprint of the caller, for rate-limit keys. */
export async function callerFingerprint(): Promise<string> {
  const h = await headers();
  const ip =
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip") ||
    "local";
  const agent = h.get("user-agent") ?? "";
  return createHash("sha256").update(`${ip}|${agent}`).digest("hex").slice(0, 24);
}

export async function sweepRateLimits(olderThanMs = 24 * 60 * 60 * 1000) {
  await run("DELETE FROM rate_limits WHERE window_start < ?", now() - olderThanMs);
}
