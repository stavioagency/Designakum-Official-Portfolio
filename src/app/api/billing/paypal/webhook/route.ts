import { get } from "@/lib/db";
import {
  addMonths,
  latestSubscription,
  logBillingEvent,
  planDefinitions,
  recordSubscription,
  setSubscriptionStatus,
} from "@/lib/billing";
import { verifyWebhook } from "@/lib/paypal";
import { reportError } from "@/lib/observability";
import { run, now } from "@/lib/db";
import type { Plan, User } from "@/lib/types";

/**
 * The authoritative source for subscription state.
 *
 * Every event is verified against PayPal before it is believed — without that,
 * anyone who found this URL could post themselves a subscription. PayPal retries
 * on a non-2xx, so anything we cannot act on is acknowledged rather than left to
 * be redelivered forever.
 */
export async function POST(request: Request) {
  const raw = await request.text();

  if (!(await verifyWebhook(request.headers, raw))) {
    return new Response("Invalid signature", { status: 401 });
  }

  let event: {
    event_type: string;
    resource?: {
      id?: string;
      custom_id?: string;
      status?: string;
      plan_id?: string;
      billing_info?: { next_billing_time?: string };
      billing_agreement_id?: string;
    };
  };

  try {
    event = JSON.parse(raw);
  } catch {
    return new Response("Unparseable", { status: 400 });
  }

  const resource = event.resource ?? {};
  const userId = resource.custom_id;

  try {
    switch (event.event_type) {
      case "BILLING.SUBSCRIPTION.ACTIVATED": {
        if (!userId) break;
        const user = await get<User>("SELECT * FROM users WHERE id = ?", userId);
        if (!user) break;

        const existing = await latestSubscription(userId);
        // The return handler usually records this first; don't duplicate it.
        if (existing && existing.provider_subscription_id === resource.id && existing.status === "active") {
          break;
        }

        // Fall back to monthly when we have no prior record to read the plan from.
        const plan: Exclude<Plan, "free"> = existing && existing.plan === "yearly" ? "yearly" : "monthly";
        const definition = (await planDefinitions())[plan];

        await recordSubscription({
          userId,
          plan,
          status: "active",
          provider: "paypal",
          source: "paid",
          amount: definition.amount,
          providerSubscriptionId: resource.id ?? null,
          currentPeriodEnd: resource.billing_info?.next_billing_time
            ? new Date(resource.billing_info.next_billing_time).getTime()
            : addMonths(Date.now(), plan === "yearly" ? 12 : 1),
        });
        break;
      }

      case "BILLING.SUBSCRIPTION.CANCELLED":
      case "BILLING.SUBSCRIPTION.EXPIRED": {
        if (!userId) break;
        const existing = await latestSubscription(userId);
        if (!existing) break;

        await setSubscriptionStatus(
          existing.id,
          event.event_type.endsWith("CANCELLED") ? "canceled" : "expired",
        );
        await run("UPDATE users SET plan = 'free', updated_at = ? WHERE id = ?", now(), userId);
        await logBillingEvent(userId, event.event_type.toLowerCase(), resource.id ?? "");
        break;
      }

      case "BILLING.SUBSCRIPTION.SUSPENDED":
      case "BILLING.SUBSCRIPTION.PAYMENT.FAILED": {
        if (!userId) break;
        const existing = await latestSubscription(userId);
        if (existing) await setSubscriptionStatus(existing.id, "past_due");
        await logBillingEvent(userId, "payment.failed", resource.id ?? "");
        break;
      }

      case "PAYMENT.SALE.COMPLETED": {
        // A renewal: push the period out so entitlement does not lapse.
        const agreement = resource.billing_agreement_id;
        if (!agreement) break;

        const existing = await get<{ id: string; user_id: string; plan: string }>(
          "SELECT id, user_id, plan FROM subscriptions WHERE provider_subscription_id = ? ORDER BY created_at DESC LIMIT 1",
          agreement,
        );
        if (!existing) break;

        await run(
          `UPDATE subscriptions SET status = 'active', current_period_end = ?, updated_at = ?
            WHERE id = ?`,
          addMonths(Date.now(), existing.plan === "yearly" ? 12 : 1),
          now(),
          existing.id,
        );
        await logBillingEvent(existing.user_id, "payment.renewed", agreement);
        break;
      }

      default:
        break;
    }
  } catch (error) {
    reportError(error, { area: "paypal-webhook", event: event.event_type });
    // Acknowledge regardless: PayPal retries non-2xx, and a bug here would turn
    // into an unbounded redelivery loop.
  }

  return new Response(null, { status: 204 });
}
