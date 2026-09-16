import "server-only";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { get, now, run } from "./db";
import { newId } from "./ids";
import type { User } from "./types";

/**
 * A pending change of the address an account signs in with.
 *
 * The new address is proven before it is adopted, and the proof is the only
 * thing standing between this feature and an account takeover: the Google
 * callback links an incoming identity to whichever account already holds that
 * email, so an address you could claim without proving it would be an address
 * you could use to collect someone else's sign-in.
 *
 * Thirty minutes rather than the hour a password reset gets. A reset is asked
 * for by someone locked out, who may have to go and find their password
 * manager; this is asked for by someone already signed in, with the inbox open.
 */
const TTL = 30 * 60 * 1000;

/** Only the hash is stored, so a database leak cannot be replayed as a link. */
const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export async function createEmailChange(user: User, newEmail: string): Promise<string> {
  // Asking again abandons the previous address: two live links would let an
  // account be pointed at whichever inbox answered first.
  await run(
    "UPDATE email_changes SET used_at = ? WHERE user_id = ? AND used_at IS NULL",
    now(),
    user.id,
  );

  const token = randomBytes(32).toString("base64url");
  await run(
    `INSERT INTO email_changes (id, user_id, new_email, token_hash, expires_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    newId("ecg"),
    user.id,
    newEmail.trim().toLowerCase(),
    hashToken(token),
    now() + TTL,
    now(),
  );
  return token;
}

export interface EmailChangeRecord {
  id: string;
  user_id: string;
  new_email: string;
  expires_at: number;
  used_at: number | null;
}

export async function findValidEmailChange(token: string): Promise<EmailChangeRecord | null> {
  if (!token) return null;

  const row = await get<EmailChangeRecord & { token_hash: string }>(
    "SELECT * FROM email_changes WHERE token_hash = ?",
    hashToken(token),
  );
  if (!row) return null;

  // Constant-time even though the lookup was by hash, so a timing difference
  // cannot separate "wrong token" from "expired token".
  const expected = Buffer.from(row.token_hash);
  const actual = Buffer.from(hashToken(token));
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;

  if (row.used_at !== null) return null;
  if (row.expires_at < now()) return null;
  return row;
}

/**
 * Just the address a token is waiting on, for the confirmation page.
 *
 * The page needs one string, and anything a server component awaits can end up
 * serialised into the payload the browser receives — handing back the whole row
 * put `token_hash` and `user_id` in the page source. Narrow it here instead, so
 * there is nothing else to leak.
 */
export async function pendingEmailFor(token: string): Promise<string | null> {
  const record = await findValidEmailChange(token);
  return record ? record.new_email : null;
}

export async function consumeEmailChange(id: string) {
  await run("UPDATE email_changes SET used_at = ? WHERE id = ?", now(), id);
}

/** Any other account holding this address — checked again at the moment of adoption. */
export async function emailTaken(email: string, exceptUserId: string): Promise<boolean> {
  const row = await get<{ id: string }>(
    "SELECT id FROM users WHERE email = ? AND id <> ?",
    email.trim().toLowerCase(),
    exceptUserId,
  );
  return Boolean(row);
}

/**
 * Called when a password changes. The notice sent to the old address promises
 * exactly this, and it is the only lever someone has if a request was made by
 * whoever had their password: change it, and the pending move dies with it.
 */
export async function cancelPendingEmailChanges(userId: string) {
  await run(
    "UPDATE email_changes SET used_at = ? WHERE user_id = ? AND used_at IS NULL",
    now(),
    userId,
  );
}

export async function sweepExpiredEmailChanges() {
  await run("DELETE FROM email_changes WHERE expires_at < ?", now() - 7 * 24 * 60 * 60 * 1000);
}
