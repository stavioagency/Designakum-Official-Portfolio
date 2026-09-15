"use server";

import { revalidatePath } from "next/cache";
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

function fail(error: unknown): ActionState {
  return { error: error instanceof Error ? error.message : "تعذّر تنفيذ العملية" };
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
    if (!plan) return { error: "باقة غير معروفة" };

    const provider = billingProvider();
    if (!provider) {
      logBillingEvent(user.id, "checkout.unavailable", plan);
      return {
        error:
          "الدفع الإلكتروني غير مفعّل على هذه النسخة بعد. تواصل مع إدارة المنصة لتفعيل اشتراكك.",
      };
    }

    const origin = await requestOrigin();
    const checkout = await provider.createCheckout({
      user,
      plan,
      successUrl: `${origin}/dashboard/billing?checkout=success`,
      cancelUrl: `${origin}/dashboard/billing?checkout=cancelled`,
    });

    logBillingEvent(user.id, "checkout.started", `${plan} · ${provider.id}`);
    destination = checkout.url;
  } catch (error) {
    return fail(error);
  }

  redirect(destination);
}

export async function cancelSubscriptionAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const user = await requireUser();
    const immediately = str(fd, "immediately") === "1";
    cancelSubscription(user.id, immediately);
    revalidatePath("/dashboard/billing");
    return {
      ok: immediately
        ? "تم إلغاء الاشتراك"
        : "سيتوقف التجديد في نهاية الفترة الحالية",
    };
  } catch (error) {
    return fail(error);
  }
}
