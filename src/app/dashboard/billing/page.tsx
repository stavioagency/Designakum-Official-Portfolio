import type { Metadata } from "next";
import { visitorCurrency } from "@/lib/visitor-currency";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import {
  activeSubscription,
  billingConfigured,
  billingEvents,
  entitlementsFor,
  latestSubscription,
} from "@/lib/billing";
import { currentLocale } from "@/lib/locale";
import { dict, fill } from "@/lib/i18n";
import { pricingCopy } from "@/lib/pricing-copy";
import { Pricing } from "@/components/pricing";
import { CancelSubscription, CheckoutButton } from "@/components/billing/plan-actions";
import { RedeemInvite } from "@/components/billing/redeem-invite";
import { Check, Shield, Sparkle } from "@/components/icons";
import { formatDate, formatDateTime } from "@/components/console/ui";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: dict(await currentLocale()).meta.billing,
  };
}
export const dynamic = "force-dynamic";



export default async function BillingPage() {
  const user = await currentUser();
  if (!user) redirect("/login");

  const locale = await currentLocale();
  const d = dict(locale);
  const b = d.dashboard.billing;
  const planLabel: Record<string, string> = {
    free: d.dashboard.settings.planFree,
    monthly: d.dashboard.settings.planMonthly,
    yearly: d.dashboard.settings.planYearly,
  };
  const statusLabel: Record<string, string> = b.status;
  const copy = await pricingCopy(locale, (await visitorCurrency()).code);

  const subscription = await activeSubscription(user.id);
  const latest = await latestSubscription(user.id);
  const limits = await entitlementsFor(user);
  const events = await billingEvents(user.id);

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-7 sm:px-6 lg:py-10">
      <header className="mb-6">
        <h1 className="text-[26px] font-bold">{b.title}</h1>
        <p className="mt-1 text-[13.5px] text-mist-400">{b.subtitle}</p>
      </header>

      <section className="card mb-4 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[12.5px] text-mist-500">{b.currentPlan}</p>
            <p className="mt-1.5 flex items-center gap-2.5 text-[22px] font-bold">
              {limits.active ? (
                <Sparkle className="h-5 w-5" style={{ color: "var(--accent-ring)" }} />
              ) : (
                <Shield className="h-5 w-5 text-mist-500" />
              )}
              {b.planPrefix} {planLabel[limits.plan] ?? limits.plan}
            </p>

            {subscription?.current_period_end && (
              <p className="mt-2 text-[13px] text-mist-400">
                {subscription.cancel_at_period_end
                  ? fill(b.endsOn, { date: formatDate(subscription.current_period_end, locale) })
                  : fill(b.renewsOn, { date: formatDate(subscription.current_period_end, locale) })}
              </p>
            )}

            {!limits.active && latest && (
              <p className="mt-2 text-[13px] text-amber-300">
                {fill(b.lastSubscription, {
                  plan: planLabel[latest.plan] ?? latest.plan,
                  status: statusLabel[latest.status] ?? latest.status,
                })}
              </p>
            )}
          </div>

          <span
            className={`rounded-full px-3 py-1.5 text-[12px] font-semibold ${
              limits.active ? "bg-emerald-400/12 text-emerald-300" : "bg-white/[0.07] text-mist-400"
            }`}
          >
            {limits.active ? b.status.active : b.noSubscription}
          </span>
        </div>

        <p
          className={`mt-5 rounded-2xl border px-4 py-3.5 text-[13.5px] leading-relaxed ${
            limits.canPublish
              ? "border-emerald-400/25 bg-emerald-400/[0.07] text-emerald-200"
              : "border-amber-400/25 bg-amber-400/[0.07] text-amber-200"
          }`}
        >
          {limits.canPublish
            ? b.canPublish
            : b.cannotPublish}
        </p>

        {subscription && (
          <div className="mt-5 border-t border-white/8 pt-5">
            <CancelSubscription
              atPeriodEnd={subscription.cancel_at_period_end === 1}
              copy={{
                cancelRenewal: d.dashboard.home.cancelRenewal,
                renewalStopped: d.dashboard.home.renewalStopped,
                pending: d.dashboard.common.pending,
              }}
            />
          </div>
        )}
      </section>

      {!limits.active && (
        <section className="card mb-4 p-5 sm:p-6">
          <h2 className="text-[15px] font-semibold">{b.inviteHeading}</h2>
          <p className="mb-4 mt-1 text-[13px] text-mist-400">{b.inviteBody}</p>
          <RedeemInvite copy={{ redeem: b.redeem, redeeming: b.redeeming }} />
        </section>
      )}

      {!billingConfigured() && (
        <p className="panel mb-6 px-4 py-3 text-[12.5px] leading-relaxed text-mist-400">
          {b.noProvider}
        </p>
      )}

      <Pricing
        copy={copy}
        currentPlan={limits.active ? limits.plan : "free"}
        heading
        monthlyCta={
          limits.plan === "monthly" && limits.active ? undefined : (
            <CheckoutButton
              plan="monthly"
              label={d.pricing.cta}
              highlighted={false}
              pendingLabel={d.dashboard.common.pending}
            />
          )
        }
        yearlyCta={
          limits.plan === "yearly" && limits.active ? undefined : (
            <CheckoutButton
              plan="yearly"
              label={d.pricing.cta}
              highlighted
              pendingLabel={d.dashboard.common.pending}
            />
          )
        }
      />

      {events.length > 0 && (
        <section className="card mt-8 overflow-hidden">
          <h2 className="border-b border-white/8 px-5 py-4 text-[15px] font-semibold">{b.history}</h2>
          <ul className="divide-y divide-white/6">
            {events.map((event) => (
              <li key={event.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3">
                <span className="text-[13px] text-mist-300">{event.kind}</span>
                <span className="text-[12px] text-mist-500">{event.detail}</span>
                <span className="text-[12px] text-mist-500">{formatDateTime(event.created_at, locale)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
