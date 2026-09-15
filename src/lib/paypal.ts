import "server-only";
import { readSettings, writeSetting } from "./settings";
import { reportError } from "./observability";

/**
 * PayPal Subscriptions.
 *
 * PayPal cannot transact in SAR, so prices are set and displayed in riyals and
 * charged in dollars at the peg — see `inChargeCurrency`. Both figures are shown
 * before checkout so a customer is never surprised by their statement.
 *
 * The object model is: a Product (the service), a Plan per billing period (the
 * price), and a Subscription per customer. Products and plans are created once
 * and their ids kept in platform settings; a price change creates a new plan,
 * because PayPal plan pricing is not freely mutable.
 */
const API = () =>
  process.env.PAYPAL_ENV === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";

export const paypalConfigured = () =>
  Boolean(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET);

export const paypalIsLive = () => process.env.PAYPAL_ENV === "live";

let cachedToken: { value: string; expiresAt: number } | null = null;

async function accessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.value;

  const id = process.env.PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_CLIENT_SECRET;
  if (!id || !secret) throw new Error("PayPal credentials are not configured.");

  const response = await fetch(`${API()}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!response.ok) {
    throw new Error(`PayPal rejected the credentials (${response.status})`);
  }

  const token = (await response.json()) as { access_token: string; expires_in: number };
  cachedToken = {
    value: token.access_token,
    expiresAt: Date.now() + token.expires_in * 1000,
  };
  return cachedToken.value;
}

async function call<T>(
  path: string,
  init: { method?: string; body?: unknown; headers?: Record<string, string> } = {},
): Promise<T> {
  const response = await fetch(`${API()}${path}`, {
    method: init.method ?? "GET",
    headers: {
      Authorization: `Bearer ${await accessToken()}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`PayPal ${init.method ?? "GET"} ${path} failed (${response.status}): ${text}`);
  }
  return (text ? JSON.parse(text) : {}) as T;
}

/* ----------------------------------------------------------- product & plans */

async function ensureProduct(): Promise<string> {
  const settings = await readSettings();
  const existing = settings["paypal.product_id"];
  if (existing) return existing;

  const product = await call<{ id: string }>("/v1/catalogs/products", {
    method: "POST",
    body: {
      name: "Designakum",
      description: "نشر معرض الأعمال على منصة ديزاينكم",
      type: "SERVICE",
      category: "SOFTWARE",
    },
    // Retrying a create must not produce a second product.
    headers: { "PayPal-Request-Id": "designakum-product-v1" },
  });

  await writeSetting("paypal.product_id", product.id, "system");
  return product.id;
}

export interface PlanSpec {
  plan: "monthly" | "yearly";
  amount: number;
  currency: string;
}

/**
 * Returns the PayPal plan id for a billing period, creating it if the price has
 * changed since last time. The stored key includes the amount, so editing the
 * price in the console produces a new plan rather than silently charging the old one.
 */
export async function ensurePlan(spec: PlanSpec): Promise<string> {
  const settings = await readSettings();
  const key = spec.plan === "monthly" ? "paypal.plan_monthly" : "paypal.plan_yearly";
  const stamp = `${spec.currency}:${spec.amount.toFixed(2)}`;

  const stored = settings[key];
  if (stored && stored.startsWith(`${stamp}|`)) return stored.split("|")[1];

  const productId = await ensureProduct();
  const plan = await call<{ id: string }>("/v1/billing/plans", {
    method: "POST",
    body: {
      product_id: productId,
      name: spec.plan === "monthly" ? "Designakum — Monthly" : "Designakum — Yearly",
      description:
        spec.plan === "monthly"
          ? "Publish your Designakum portfolio, billed monthly"
          : "Publish your Designakum portfolio, billed yearly",
      status: "ACTIVE",
      billing_cycles: [
        {
          frequency: {
            interval_unit: spec.plan === "monthly" ? "MONTH" : "YEAR",
            interval_count: 1,
          },
          tenure_type: "REGULAR",
          sequence: 1,
          // 0 means "until cancelled".
          total_cycles: 0,
          pricing_scheme: {
            fixed_price: { value: spec.amount.toFixed(2), currency_code: spec.currency },
          },
        },
      ],
      payment_preferences: {
        auto_bill_outstanding: true,
        setup_fee_failure_action: "CANCEL",
        payment_failure_threshold: 2,
      },
    },
    headers: { "PayPal-Request-Id": `designakum-plan-${spec.plan}-${stamp}` },
  });

  await writeSetting(key, `${stamp}|${plan.id}`, "system");
  return plan.id;
}

/* ------------------------------------------------------------ subscriptions */

export interface PayPalSubscription {
  id: string;
  status: string;
  custom_id?: string;
  plan_id?: string;
  subscriber?: { email_address?: string; payer_id?: string };
  billing_info?: { next_billing_time?: string };
}

export async function createSubscription(input: {
  planId: string;
  userId: string;
  email: string;
  returnUrl: string;
  cancelUrl: string;
}): Promise<{ id: string; approveUrl: string }> {
  const subscription = await call<{
    id: string;
    links: { rel: string; href: string }[];
  }>("/v1/billing/subscriptions", {
    method: "POST",
    body: {
      plan_id: input.planId,
      // Ties the PayPal subscription back to our account without trusting anything
      // the browser sends back on return.
      custom_id: input.userId,
      subscriber: { email_address: input.email },
      application_context: {
        brand_name: "Designakum",
        locale: "ar-SA",
        user_action: "SUBSCRIBE_NOW",
        payment_method: { payer_selected: "PAYPAL", payee_preferred: "IMMEDIATE_PAYMENT_REQUIRED" },
        return_url: input.returnUrl,
        cancel_url: input.cancelUrl,
      },
    },
  });

  const approve = subscription.links.find((link) => link.rel === "approve");
  if (!approve) throw new Error("PayPal returned no approval link");

  return { id: subscription.id, approveUrl: approve.href };
}

export const getSubscription = (id: string) =>
  call<PayPalSubscription>(`/v1/billing/subscriptions/${id}`);

export const cancelSubscription = (id: string, reason: string) =>
  call<void>(`/v1/billing/subscriptions/${id}/cancel`, {
    method: "POST",
    body: { reason: reason.slice(0, 127) },
  });

/* ---------------------------------------------------------------- webhooks */

/**
 * Verifies a webhook against PayPal rather than trusting the request. Without
 * this, anyone who knows the endpoint could grant themselves a subscription.
 */
export async function verifyWebhook(
  headers: Headers,
  rawBody: string,
): Promise<boolean> {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;
  if (!webhookId) {
    reportError(new Error("PAYPAL_WEBHOOK_ID is not set; refusing to trust a webhook"), {
      area: "paypal",
    });
    return false;
  }

  try {
    const result = await call<{ verification_status: string }>(
      "/v1/notifications/verify-webhook-signature",
      {
        method: "POST",
        body: {
          auth_algo: headers.get("paypal-auth-algo"),
          cert_url: headers.get("paypal-cert-url"),
          transmission_id: headers.get("paypal-transmission-id"),
          transmission_sig: headers.get("paypal-transmission-sig"),
          transmission_time: headers.get("paypal-transmission-time"),
          webhook_id: webhookId,
          webhook_event: JSON.parse(rawBody),
        },
      },
    );
    return result.verification_status === "SUCCESS";
  } catch (error) {
    reportError(error, { area: "paypal", step: "verify-webhook" });
    return false;
  }
}
