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
