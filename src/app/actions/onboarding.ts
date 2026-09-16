"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import {
  TenantError,
  getPortfolioForUser,
  updateProfile,
  updateSlug,
} from "@/lib/portfolios";
import { markOnboarded, needsOnboarding } from "@/lib/onboarding";
import type { FormState } from "@/app/actions/auth";

/**
 * Finishes the one step between signing up and the editor: the customer confirms
 * the link we suggested, or picks their own, and optionally says what they do.
 *
 * Idempotent on purpose — a customer who is already onboarded lands here only by
 * navigating back, and should simply be returned to the editor.
 */
export async function claimLinkAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  if (!needsOnboarding(user)) redirect("/dashboard");

  const portfolio = await getPortfolioForUser(user.id);
  if (!portfolio) redirect("/login");

  const desired = String(fd.get("slug") ?? "").trim();
  const title = String(fd.get("title") ?? "").trim();

  try {
    if (desired) await updateSlug(portfolio.id, user, desired);
    if (title) await updateProfile(portfolio.id, user, { title });
  } catch (error) {
    // updateSlug speaks the customer's language already, so the message is shown
    // as-is rather than being looked up in the authErrors dictionary.
    if (error instanceof TenantError) return { error: error.message };
    throw error;
  }

  await markOnboarded(user.id);
  redirect("/dashboard");
}
