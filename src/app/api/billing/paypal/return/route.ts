import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import {
  addMonths,
  inChargeCurrency,
  logBillingEvent,
  planDefinitions,
  recordSubscription,
} from "@/lib/billing";
import { getSubscription } from "@/lib/paypal";
import { reportError } from "@/lib/observability";
import { audit } from "@/lib/audit";
import { notifySubscriptionActive } from "@/lib/billing-mail";
import { requestOrigin } from "@/lib/origin";
import type { Plan } from "@/lib/types";

/**
 * Where PayPal returns the customer after approval.
 *
 * The subscription is re-read from PayPal rather than trusted from the query
 * string, and `custom_id` is checked against the signed-in account — otherwise
 * anyone could append someone else's subscription id and claim it. The webhook
 * is the authoritative path; this exists so the customer sees the result at once
 * instead of waiting for a callback.
 */
export async function GET(request: Request) {
  const origin = await requestOrigin();
  const params = new URL(request.url).searchParams;
  const subscriptionId = params.get("subscription_id");
  const plan = params.get("plan") as Exclude<Plan, "free"> | null;

  const back = (state: string) =>
    NextResponse.redirect(`${origin}/dashboard/billing?checkout=${state}`);

  const user = await currentUser();
  if (!user) return NextResponse.redirect(`${origin}/login`);
  if (!subscriptionId || (plan !== "monthly" && plan !== "yearly")) return back("invalid");

  try {
    const subscription = await getSubscription(subscriptionId);

    if (subscription.custom_id !== user.id) {
      reportError(new Error("PayPal subscription did not belong to the signed-in user"), {
        area: "paypal-return",
        subscriptionId,
        userId: user.id,
      });
      return back("mismatch");
    }

    // APPROVAL_PENDING means the customer bailed before completing.
    if (!["ACTIVE", "APPROVED"].includes(subscription.status)) {
      await logBillingEvent(user.id, "checkout.incomplete", `paypal ${subscription.status}`);
      return back("cancelled");
    }

    const definition = (await planDefinitions())[plan];
    const charge = await inChargeCurrency(definition.amount);
    const periodEnd = subscription.billing_info?.next_billing_time
      ? new Date(subscription.billing_info.next_billing_time).getTime()
      : addMonths(Date.now(), plan === "yearly" ? 12 : 1);

    await recordSubscription({
      userId: user.id,
      plan,
      status: "active",
      provider: "paypal",
      source: "paid",
      amount: definition.amount,
      providerSubscriptionId: subscription.id,
      providerCustomerId: subscription.subscriber?.payer_id ?? null,
      currentPeriodEnd: periodEnd,
    });

    await notifySubscriptionActive(user, {
      plan,
      charged: `${charge.display} ${charge.currency}`,
      periodEnd,
    });

    await audit({
      actor: user,
      action: "subscription.activated",
      targetType: "user",
      targetId: user.id,
      targetLabel: user.email,
      after: { plan, provider: "paypal", charged: `${charge.display} ${charge.currency}` },
    });

    return back("success");
  } catch (error) {
    reportError(error, { area: "paypal-return", subscriptionId });
    return back("error");
  }
}
