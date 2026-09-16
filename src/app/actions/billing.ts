"use server";

import { revalidatePath } from "next/cache";
import { messages } from "@/lib/locale";
import { fill } from "@/lib/i18n";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { billingProvider, cancelSubscription, logBillingEvent } from "@/lib/billing";
import { requestOrigin } from "@/lib/origin";
import type { ActionState } from "./portfolio";
import type { Plan } from "@/lib/types";

const str = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();

function paidPlan(value: string): Exclude<Plan, "free"> | null {
  return value === "monthly" || value === "yearly" ? value : null;
}

async function fail(error: unknown): Promise<ActionState> {
  return { error: error instanceof Error ? error.message : (await messages()).failed };
}

/**
 * Starts a real checkout with whichever payment provider is configured. Nothing is
 * charged, granted or faked here: with no provider wired up the client is told
 * plainly that checkout isn't available yet.
 */
export async function startCheckoutAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  let destination: string | null = null;

  try {
    const user = await requireUser();
    const plan = paidPlan(str(fd, "plan"));
    if (!plan) return { error: (await messages()).unknownPlan };

    const provider = billingProvider();
    if (!provider) {
      await logBillingEvent(user.id, "checkout.unavailable", plan);
      return {
        error:
          (await messages()).billingUnavailable,
      };
    }

    const origin = await requestOrigin();
    const checkout = await provider.createCheckout({
      user,
      plan,
      // The provider's return route, NOT the billing page: approval only becomes a
      // subscription because that route re-reads it from the provider and records
      // it. Sending the customer straight to the billing page shows them "success"
      // for a subscription that was never saved.
      successUrl: `${origin}/api/billing/paypal/return`,
      cancelUrl: `${origin}/dashboard/billing?checkout=cancelled`,
    });

    await logBillingEvent(user.id, "checkout.started", `${plan} · ${provider.id}`);
    destination = checkout.url;
  } catch (error) {
    return await fail(error);
  }

  redirect(destination);
}

export async function cancelSubscriptionAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const user = await requireUser();
    const immediately = str(fd, "immediately") === "1";
    await cancelSubscription(user.id, immediately);
    revalidatePath("/dashboard/billing");
    const m = await messages();
    return { ok: immediately ? m.subscriptionCanceled : m.renewalStopped };
  } catch (error) {
    return await fail(error);
  }
}
