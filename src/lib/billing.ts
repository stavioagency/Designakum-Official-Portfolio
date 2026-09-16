import "server-only";
import { all, get, now, run } from "./db";
import { newId } from "./ids";
import { readSettings } from "./settings";
import {
  createSubscription as createPayPalSubscription,
  ensurePlan,
  paypalConfigured,
} from "./paypal";
import type { Plan, Subscription, SubscriptionStatus, SubscriptionSource, User } from "./types";

/* ------------------------------------------------------------------- pricing */

export interface PlanDefinition {
  id: Exclude<Plan, "free">;
  /** Price in halalas, the smallest unit — money never touches a float. */
  amount: number;
  currency: "SAR";
  intervalMonths: number;
}

/** Shape and fallbacks; live prices come from platform settings. */
export const PLANS: Record<Exclude<Plan, "free">, PlanDefinition> = {
  monthly: { id: "monthly", amount: 12_00, currency: "SAR", intervalMonths: 1 },
  yearly: { id: "yearly", amount: 120_00, currency: "SAR", intervalMonths: 12 },
};

/**
 * Prices are owner-editable, so every figure the product shows or charges is read
 * through here rather than from the constant above.
 */
export async function planDefinitions(): Promise<Record<Exclude<Plan, "free">, PlanDefinition>>{
  const settings = await readSettings();
  return {
    monthly: { ...PLANS.monthly, amount: settings["pricing.monthly_halalas"] },
    yearly: { ...PLANS.yearly, amount: settings["pricing.yearly_halalas"] },
  };
}

export const riyals = (halalas: number) => (halalas / 100).toLocaleString("en-US", { maximumFractionDigits: 2 });

/**
 * What the customer's card is actually charged.
 *
 * Prices are set, stored and displayed in riyals — that is the real price. The
 * payment provider settles in dollars, so this converts at the peg and rounds to
 * the cent. Both figures are shown at checkout so nobody is surprised by their
 * statement.
 */
export async function inChargeCurrency(halalas: number) {
  const settings = await readSettings();
  const rate = settings["pricing.sar_per_usd"] || 3.75;
  // Widened: the default narrows to a literal, but an owner may change this.
  const currency: string = settings["pricing.charge_currency"] || "USD";

  if (currency === "SAR") {
    return { currency: "SAR", amount: halalas / 100, display: riyals(halalas) };
  }

  const amount = Math.round((halalas / 100 / rate) * 100) / 100;
  return {
    currency,
    amount,
    display: amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
  };
}

/** What a year of the monthly plan would cost, and what the yearly plan saves. */
export async function yearlySaving() {
  const plans = await planDefinitions();
  const twelveMonths = plans.monthly.amount * 12;
  const saved = twelveMonths - plans.yearly.amount;
  const percent = twelveMonths > 0 ? (saved / twelveMonths) * 100 : 0;
  return {
    twelveMonths,
    saved,
    percent,
    percentLabel: percent.toFixed(1).replace(/\.0$/, ""),
  };
}

/* -------------------------------------------------------------- entitlements */

/**
 * The subscription buys exactly one thing: the right to publish.
 *
 * Everything else — the editor, unlimited projects and slides, image uploads,
 * cropping, themes, previewing the finished page — is free and uncapped. A
 * designer can build their entire portfolio without paying and see precisely what
 * it will look like; the payment is for making it public.
 *
 * This is deliberately simple to reason about: there is no partial state where a
 * page is half-visible, and nothing a customer builds is ever taken away from
 * them when a subscription lapses — only the publishing stops.
 */
export interface Entitlements {
  plan: Plan;
  active: boolean;
  /** The only thing the subscription gates. */
  canPublish: boolean;
  /** Reserved for the custom-domain feature. */
  customDomain: boolean;
}

/* ------------------------------------------------------------ subscriptions */

export async function latestSubscription(userId: string): Promise<Subscription | undefined>{
  return await get<Subscription>(
    // `seq` breaks ties when two rows land in the same millisecond.
    "SELECT * FROM subscriptions WHERE user_id = ? ORDER BY created_at DESC, seq DESC LIMIT 1",
    userId,
  );
}

export async function subscriptionHistory(userId: string, limit = 50) {
  return await all<Subscription>(
    "SELECT * FROM subscriptions WHERE user_id = ? ORDER BY created_at DESC, seq DESC LIMIT ?",
    userId,
    Math.min(Math.max(1, limit), 200),
  );
}

/**
 * Resolves a user's live subscription, expiring it in passing when its period has
 * run out — no cron needed for the common case, and a provider webhook can still
 * push a status change in at any time.
 */
export async function activeSubscription(userId: string): Promise<Subscription | null>{
  const subscription = await latestSubscription(userId);
  if (!subscription) return null;

  const lapsed =
    subscription.current_period_end !== null && subscription.current_period_end < now();

  if (lapsed && (subscription.status === "active" || subscription.status === "past_due")) {
    await setSubscriptionStatus(subscription.id, "expired");
    // `users.plan` is only a cached mirror of this; let it drift and the customer
    // list starts disagreeing with what the customer is actually entitled to.
    await run("UPDATE users SET plan = 'free', updated_at = ? WHERE id = ?", now(), userId);
    return null;
  }
  return subscription.status === "active" ? subscription : null;
}

export async function entitlementsFor(user: User): Promise<Entitlements> {
  // Staff are never gated by billing.
  if (user.role === "owner" || user.role === "support") {
    return { plan: "yearly", active: true, canPublish: true, customDomain: true };
  }

  const subscription = await activeSubscription(user.id);
  return subscription
    ? { plan: subscription.plan, active: true, canPublish: true, customDomain: true }
    : { plan: "free", active: false, canPublish: false, customDomain: false };
}

/** Whether this account's portfolio may currently be seen by the public. */
export async function canPublish(user: User): Promise<boolean> {
  return (await entitlementsFor(user)).canPublish;
}

export async function setSubscriptionStatus(id: string, status: SubscriptionStatus) {
  await run("UPDATE subscriptions SET status = ?, updated_at = ? WHERE id = ?", status, now(), id);
}

export function periodEnd(plan: Exclude<Plan, "free">, from = now()): number {
  const date = new Date(from);
  date.setMonth(date.getMonth() + PLANS[plan].intervalMonths);
  return date.getTime();
}

export function addMonths(from: number, months: number): number {
  const date = new Date(from);
  date.setMonth(date.getMonth() + months);
  return date.getTime();
}

/**
 * Records a subscription. `provider` says where it came from — a payment provider
 * for a real purchase, or `manual` when the platform owner grants one directly.
 *
 * An account has one active subscription. Every path that creates one comes
 * through here — a manual grant, a redeemed invitation, PayPal's return and its
 * webhook — and each used to add a row, so granting a plan twice left two live
 * subscriptions on one account and the console counted both.
 *
 * Any existing active subscription is retired first, not after: interrupted
 * midway this leaves the account with none, which is visible and recoverable,
 * where the other order leaves two, which is the bug being fixed.
 */
export async function recordSubscription(input: {
  userId: string;
  plan: Exclude<Plan, "free">;
  status: SubscriptionStatus;
  provider: string;
  source?: SubscriptionSource;
  /** Halalas actually billed — 0 for a comped or invited subscription. */
  amount?: number;
  providerCustomerId?: string | null;
  providerSubscriptionId?: string | null;
  currentPeriodEnd?: number | null;
}): Promise<Subscription>{
  const id = newId("sub");
  const ts = now();

  if (input.status === "active") {
    await run(
      `UPDATE subscriptions SET status = 'superseded', updated_at = ?
        WHERE user_id = ? AND status = 'active'`,
      ts,
      input.userId,
    );
  }

  await run(
    `INSERT INTO subscriptions
       (id, user_id, plan, status, provider, provider_customer_id, provider_subscription_id,
        amount, source, started_at, current_period_end, cancel_at_period_end, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
    id,
    input.userId,
    input.plan,
    input.status,
    input.provider,
    input.providerCustomerId ?? null,
    input.providerSubscriptionId ?? null,
    input.amount ?? (input.source && input.source !== "paid" ? 0 : (await planDefinitions())[input.plan].amount),
    input.source ?? (input.provider === "manual" ? "manual" : "paid"),
    ts,
    input.currentPeriodEnd ?? null,
    ts,
    ts,
  );
  await run(
    "UPDATE users SET plan = ?, updated_at = ? WHERE id = ?",
    input.status === "active" ? input.plan : "free",
    ts,
    input.userId,
  );
  await logBillingEvent(input.userId, "subscription.recorded", `${input.plan} · ${input.status} · ${input.provider}`);
  return (await get<Subscription>("SELECT * FROM subscriptions WHERE id = ?", id))!;
}

export async function cancelSubscription(userId: string, immediately: boolean) {
  const subscription = await latestSubscription(userId);
  if (!subscription) return;

  if (immediately) {
    await setSubscriptionStatus(subscription.id, "canceled");
    await run("UPDATE subscriptions SET canceled_at = ? WHERE id = ?", now(), subscription.id);
    await run("UPDATE users SET plan = 'free', updated_at = ? WHERE id = ?", now(), userId);
  } else {
    await run(
      "UPDATE subscriptions SET cancel_at_period_end = 1, updated_at = ? WHERE id = ?",
      now(),
      subscription.id,
    );
  }
  await logBillingEvent(userId, "subscription.canceled", immediately ? "immediate" : "at period end");
}

export async function logBillingEvent(userId: string, kind: string, detail = "") {
  await run(
    "INSERT INTO billing_events (id, user_id, kind, detail, created_at) VALUES (?, ?, ?, ?, ?)",
    newId("evt"),
    userId,
    kind,
    detail,
    now(),
  );
}

export async function billingEvents(userId: string, limit = 12) {
  return await all<{ id: string; kind: string; detail: string; created_at: number }>(
    "SELECT id, kind, detail, created_at FROM billing_events WHERE user_id = ? ORDER BY created_at DESC LIMIT ?",
    userId,
    limit,
  );
}

/* ---------------------------------------------------------------- provider */

export interface CheckoutRequest {
  user: User;
  plan: Exclude<Plan, "free">;
  successUrl: string;
  cancelUrl: string;
}

export interface BillingProvider {
  id: string;
  /** Starts a hosted checkout and returns the URL to send the customer to. */
  createCheckout(request: CheckoutRequest): Promise<{ url: string }>;
}

/**
 * The payment provider, if one is configured.
 *
 * Nothing here simulates a charge: with no credentials this returns null and the
 * UI tells the customer checkout is unavailable rather than pretending. The
 * adapter shape is provider-agnostic, so a Saudi provider settling in SAR could
 * be added alongside PayPal without touching the subscription tables or the
 * entitlement checks.
 *
 * Environment:
 *   PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET   REST app credentials
 *   PAYPAL_ENV        sandbox (default) | live
 *   PAYPAL_WEBHOOK_ID id of the webhook registered in the PayPal dashboard
 */
export function billingProvider(): BillingProvider | null {
  if (!paypalConfigured()) return null;

  return {
    id: "paypal",
    async createCheckout({ user, plan, successUrl, cancelUrl }) {
      const definition = (await planDefinitions())[plan];
      const charge = await inChargeCurrency(definition.amount);

      const planId = await ensurePlan({
        plan,
        amount: charge.amount,
        currency: charge.currency,
      });

      const subscription = await createPayPalSubscription({
        planId,
        userId: user.id,
        email: user.email,
        // PayPal appends subscription_id to the return URL.
        returnUrl: `${successUrl}${successUrl.includes("?") ? "&" : "?"}plan=${plan}`,
        cancelUrl,
      });

      await logBillingEvent(
        user.id,
        "checkout.created",
        `paypal ${subscription.id} · ${charge.display} ${charge.currency}`,
      );

      return { url: subscription.approveUrl };
    },
  };
}

export const billingConfigured = () => paypalConfigured();
