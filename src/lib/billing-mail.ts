import "server-only";
import { emailTemplate } from "./emails";
import { sendMail } from "./mailer";
import { reportError } from "./observability";
import { siteUrl } from "./site";
import { REPORTING_TIMEZONE } from "./analytics";
import { get } from "./db";
import { DEFAULT_LOCALE } from "./i18n";
import type { Locale, Plan, User } from "./types";

/**
 * Subscription mail, shared by the return route and the webhook.
 *
 * Both paths can activate a subscription, and a customer must not get two
 * different-sounding emails depending on which one won the race — so the wording
 * lives here once, keyed off `users.locale`.
 *
 * Nothing here is allowed to throw. A webhook that fails because an email failed
 * gets retried by PayPal forever, and a customer whose payment succeeded should
 * never be told it did not because a mail server was slow.
 */

const PLAN_LABEL: Record<Locale, Record<Exclude<Plan, "free">, string>> = {
  ar: { monthly: "الباقة الشهرية", yearly: "الباقة السنوية" },
  en: { monthly: "Monthly plan", yearly: "Yearly plan" },
};

const formatDay = (ms: number, locale: Locale) =>
  new Date(ms).toLocaleDateString(locale === "ar" ? "ar-SA-u-nu-latn-ca-gregory" : "en-GB", {
    timeZone: REPORTING_TIMEZONE,
    year: "numeric",
    month: "long",
    day: "numeric",
  });

const localeOf = (user: { locale?: string | null }): Locale =>
  user.locale === "en" || user.locale === "ar" ? user.locale : DEFAULT_LOCALE;

async function send(kind: string, user: User, composed: { subject: string; body: string }) {
  try {
    await sendMail({ to: user.email, subject: composed.subject, kind, body: composed.body });
  } catch (error) {
    reportError(error, { area: "billing-mail", kind, userId: user.id });
  }
}

/** Looks up the account so a webhook, which has only an id, can still write to a person. */
export async function userFor(userId: string): Promise<User | undefined> {
  try {
    return await get<User>("SELECT * FROM users WHERE id = ?", userId);
  } catch (error) {
    reportError(error, { area: "billing-mail", userId });
    return undefined;
  }
}

async function portfolioUrl(user: User): Promise<string> {
  const origin = await siteUrl();
  const row = await get<{ slug: string }>(
    "SELECT slug FROM portfolios WHERE user_id = ? ORDER BY created_at LIMIT 1",
    user.id,
  );
  return row ? `${origin}/p/${row.slug}` : `${origin}/dashboard`;
}

export async function notifySubscriptionActive(
  user: User,
  input: { plan: Exclude<Plan, "free">; charged: string; periodEnd: number },
) {
  try {
    const locale = localeOf(user);
    await send(
      "subscription_activated",
      user,
      emailTemplate.subscriptionActivated(locale, {
        name: user.display_name || "",
        plan: PLAN_LABEL[locale][input.plan],
        charged: input.charged,
        renewsOn: formatDay(input.periodEnd, locale),
        portfolioUrl: await portfolioUrl(user),
      }),
    );
  } catch (error) {
    reportError(error, { area: "billing-mail", kind: "subscription_activated", userId: user.id });
  }
}

export async function notifyPaymentFailed(user: User) {
  try {
    const locale = localeOf(user);
    await send(
      "payment_failed",
      user,
      emailTemplate.paymentFailed(locale, {
        name: user.display_name || "",
        billingUrl: `${await siteUrl()}/dashboard/billing`,
      }),
    );
  } catch (error) {
    reportError(error, { area: "billing-mail", kind: "payment_failed", userId: user.id });
  }
}

export async function notifySubscriptionEnded(user: User) {
  try {
    const locale = localeOf(user);
    await send(
      "subscription_ended",
      user,
      emailTemplate.subscriptionEnded(locale, {
        name: user.display_name || "",
        billingUrl: `${await siteUrl()}/dashboard/billing`,
      }),
    );
  } catch (error) {
    reportError(error, { area: "billing-mail", kind: "subscription_ended", userId: user.id });
  }
}
