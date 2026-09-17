import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { all, get, now, run } from "./db";
import { newId } from "./ids";
import { generateRecoveryCodes, generateSecret, otpauthUri, verifyCode } from "./totp";
import type { User } from "./types";

export { generateSecret, otpauthUri };

/**
 * Two-factor sign-in for the people who can reach everything.
 *
 * Three owner accounts share the console, the customer list and every payment
 * record between them, and a reused password is all that stands in front of it.
 *
 * Offered rather than forced: an account that switches it on mid-session, gets
 * the QR code wrong and then signs out is locked out of its own platform. It is
 * enabled only after a code from the app has been checked, which proves the
 * pairing worked before it starts being required.
 */

const hashCode = (code: string) =>
  createHash("sha256").update(code.replace(/[\s-]/g, "").toUpperCase()).digest("hex");

/** Freshly generated codes, returned once so the console can show them once. */
export async function beginEnrolment(): Promise<{ secret: string }> {
  return { secret: generateSecret() };
}

/**
 * Turns it on, but only against a code the authenticator has actually produced.
 *
 * The secret is stored at this point and not before: a half-finished enrolment
 * leaves nothing behind to trip over at the next sign-in.
 */
export async function enable(
  user: User,
  secret: string,
  code: string,
): Promise<{ ok: true; recoveryCodes: string[] } | { ok: false }> {
  if (!verifyCode(secret, code)) return { ok: false };

  const codes = generateRecoveryCodes();
  const ts = now();

  await run(
    "UPDATE users SET two_factor_secret = ?, two_factor_enabled = 1, updated_at = ? WHERE id = ?",
    secret,
    ts,
    user.id,
  );

  // Any codes from a previous enrolment stop working the moment a new set is
  // issued, so an old printout is not a way back into a re-secured account.
  await run("DELETE FROM two_factor_recovery WHERE user_id = ?", user.id);
  for (const plain of codes) {
    await run(
      "INSERT INTO two_factor_recovery (id, user_id, code_hash, created_at) VALUES (?, ?, ?, ?)",
      newId("rec"),
      user.id,
      hashCode(plain),
      ts,
    );
  }

  return { ok: true, recoveryCodes: codes };
}

export async function disable(user: User) {
  await run(
    "UPDATE users SET two_factor_secret = '', two_factor_enabled = 0, updated_at = ? WHERE id = ?",
    now(),
    user.id,
  );
  await run("DELETE FROM two_factor_recovery WHERE user_id = ?", user.id);
}

export const isEnabled = (user: User) =>
  user.two_factor_enabled === 1 && user.two_factor_secret !== "";

/**
 * Accepts either the app's six digits or one recovery code.
 *
 * A recovery code is spent whether or not the rest of the sign-in succeeds —
 * it has been typed into a form by then, which is enough to treat it as used.
 */
export async function verifySecondFactor(user: User, input: string): Promise<boolean> {
  const typed = input.trim();
  if (!typed) return false;

  if (verifyCode(user.two_factor_secret, typed)) return true;

  const wanted = hashCode(typed);
  const candidates = await all<{ id: string; code_hash: string }>(
    "SELECT id, code_hash FROM two_factor_recovery WHERE user_id = ? AND used_at IS NULL",
    user.id,
  );

  for (const candidate of candidates) {
    const a = Buffer.from(candidate.code_hash);
    const b = Buffer.from(wanted);
    if (a.length === b.length && timingSafeEqual(a, b)) {
      await run("UPDATE two_factor_recovery SET used_at = ? WHERE id = ?", now(), candidate.id);
      return true;
    }
  }
  return false;
}

/** How many ways back in are left, so the console can say when they run low. */
export async function recoveryCodesLeft(userId: string): Promise<number> {
  const row = await get<{ n: number }>(
    "SELECT COUNT(*) AS n FROM two_factor_recovery WHERE user_id = ? AND used_at IS NULL",
    userId,
  );
  return row?.n ?? 0;
}
