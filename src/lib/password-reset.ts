import "server-only";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { get, now, run } from "./db";
import { newId } from "./ids";
import type { User } from "./types";

const TTL = 60 * 60 * 1000; // one hour

/** Only the hash is stored, so a database leak cannot be replayed as a reset link. */
const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export async function createPasswordReset(user: User): Promise<string>{
  // Any earlier link for this account stops working the moment a new one is asked for.
  await run("UPDATE password_resets SET used_at = ? WHERE user_id = ? AND used_at IS NULL", now(), user.id);

  const token = randomBytes(32).toString("base64url");
  await run(
    "INSERT INTO password_resets (id, user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)",
    newId("pwr"),
    user.id,
    hashToken(token),
    now() + TTL,
    now(),
  );
  return token;
}

export interface ResetRecord {
  id: string;
  user_id: string;
  expires_at: number;
  used_at: number | null;
}

export async function findValidReset(token: string): Promise<ResetRecord | null>{
  if (!token) return null;

  const row = await get<ResetRecord & { token_hash: string }>(
    "SELECT * FROM password_resets WHERE token_hash = ?",
    hashToken(token),
  );
  if (!row) return null;

  // Constant-time comparison even though the lookup was by hash, so a timing
  // difference cannot distinguish "wrong token" from "expired token".
  const expected = Buffer.from(row.token_hash);
  const actual = Buffer.from(hashToken(token));
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;

  if (row.used_at !== null) return null;
  if (row.expires_at < now()) return null;
  return row;
}

export async function consumeReset(id: string) {
  await run("UPDATE password_resets SET used_at = ? WHERE id = ?", now(), id);
}

export async function sweepExpiredResets() {
  await run("DELETE FROM password_resets WHERE expires_at < ?", now() - 7 * 24 * 60 * 60 * 1000);
}
