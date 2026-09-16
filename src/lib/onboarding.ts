import "server-only";
import { now, run } from "./db";
import type { User } from "./types";

/**
 * Whether this account still has to choose its own portfolio link.
 *
 * Sign-up by password could ask for the link on the form, but Google sign-in
 * cannot — it returns an email and a name and nothing else, so the account was
 * handed a generated slug it never agreed to. Rather than keep two different
 * answers to the same question, both routes now provision a suggestion and both
 * send the customer to /welcome to confirm or change it.
 *
 * Only customers: staff work in the console and have no portfolio link to claim.
 */
export function needsOnboarding(user: User): boolean {
  return user.role === "client" && user.onboarded_at === null;
}

export async function markOnboarded(userId: string) {
  const at = now();
  await run("UPDATE users SET onboarded_at = ?, updated_at = ? WHERE id = ?", at, at, userId);
}
