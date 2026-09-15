import type { Metadata } from "next";
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
import { dict } from "@/lib/i18n";
import { pricingCopy } from "@/lib/pricing-copy";
import { Pricing } from "@/components/pricing";
import { CancelSubscription, CheckoutButton } from "@/components/billing/plan-actions";
import { RedeemInvite } from "@/components/billing/redeem-invite";
import { Check, Shield, Sparkle } from "@/components/icons";

export const metadata: Metadata = { title: "الاشتراك" };
export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  active: "نشط",
  past_due: "متأخر السداد",
  canceled: "ملغى",
  expired: "منتهٍ",
  incomplete: "غير مكتمل",
};

const PLAN_LABEL: Record<string, string> = {
  free: "المجانية",
  monthly: "الشهرية",
  yearly: "السنوية",
};

const formatDate = (ms: number) =>
  new Date(ms).toLocaleDateString("ar-SA-u-nu-latn-ca-gregory", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

export default async function BillingPage() {
  const user = await currentUser();
  if (!user) redirect("/login");

  const locale = await currentLocale();
  const d = dict(locale);
  const copy = await pricingCopy(locale);

  const subscription = await activeSubscription(user.id);
  const latest = await latestSubscription(user.id);
  const limits = await entitlementsFor(user);
  const events = await billingEvents(user.id);

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-7 sm:px-6 lg:py-10">
      <header className="mb-6">
        <h1 className="text-[26px] font-bold">الاشتراك والفوترة</h1>
        <p className="mt-1 text-[13.5px] text-mist-400">
          باقتك الحالية، وما تشمله، وكيف ترقّيها.
        </p>
      </header>

      <section className="card mb-4 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[12.5px] text-mist-500">الباقة الحالية</p>
            <p className="mt-1.5 flex items-center gap-2.5 text-[22px] font-bold">
              {limits.active ? (
                <Sparkle className="h-5 w-5" style={{ color: "var(--accent-ring)" }} />
              ) : (
                <Shield className="h-5 w-5 text-mist-500" />
              )}
              الباقة {PLAN_LABEL[limits.plan] ?? limits.plan}
            </p>

            {subscription?.current_period_end && (
              <p className="mt-2 text-[13px] text-mist-400">
                {subscription.cancel_at_period_end
                  ? `ينتهي في ${formatDate(subscription.current_period_end)}`
                  : `يتجدد في ${formatDate(subscription.current_period_end)}`}
              </p>
            )}

            {!limits.active && latest && (
              <p className="mt-2 text-[13px] text-amber-300">
                آخر اشتراك: الباقة {PLAN_LABEL[latest.plan]} — {STATUS_LABEL[latest.status] ?? latest.status}
              </p>
            )}
          </div>

          <span
            className={`rounded-full px-3 py-1.5 text-[12px] font-semibold ${
              limits.active ? "bg-emerald-400/12 text-emerald-300" : "bg-white/[0.07] text-mist-400"
            }`}
          >
            {limits.active ? STATUS_LABEL.active : "بدون اشتراك"}
          </span>
        </div>

        <ul className="mt-5 grid gap-2.5 sm:grid-cols-2">
          {[
            limits.maxProjects === Infinity ? "أعمال بلا حد" : `حتى ${limits.maxProjects} أعمال`,
            limits.maxSlides === Infinity ? "شرائح بلا حد" : `حتى ${limits.maxSlides} شرائح`,
            limits.showBadge ? "شارة ديزاينكم تظهر في صفحتك" : "بدون شارة ديزاينكم",
            limits.analytics ? "إحصائيات مفصّلة" : "إحصائيات أساسية",
          ].map((line) => (
            <li key={line} className="flex items-start gap-2.5 text-[13.5px] text-mist-300">
              <Check className="mt-[3px] h-4 w-4 shrink-0 text-mist-500" />
              {line}
            </li>
          ))}
        </ul>

        {subscription && (
          <div className="mt-5 border-t border-white/8 pt-5">
            <CancelSubscription atPeriodEnd={subscription.cancel_at_period_end === 1} />
          </div>
        )}
      </section>

      {!limits.active && (
        <section className="card mb-4 p-5 sm:p-6">
          <h2 className="text-[15px] font-semibold">لديك رمز دعوة؟</h2>
          <p className="mb-4 mt-1 text-[13px] text-mist-400">
            أدخل الرمز الذي وصلك من فريق ديزاينكم لتفعيل اشتراكك مجانًا.
          </p>
          <RedeemInvite />
        </section>
      )}

      {!billingConfigured() && (
        <p className="panel mb-6 px-4 py-3 text-[12.5px] leading-relaxed text-mist-400">
          لم يتم ربط مزوّد دفع بهذه النسخة بعد، لذلك لا يمكن إتمام الشراء ذاتيًا.
          تواصل مع إدارة المنصة لتفعيل اشتراكك يدويًا.
        </p>
      )}

      <Pricing
        copy={copy}
        currentPlan={limits.active ? limits.plan : "free"}
        heading
        monthlyCta={
          limits.plan === "monthly" && limits.active ? undefined : (
            <CheckoutButton plan="monthly" label={d.pricing.cta} highlighted={false} />
          )
        }
        yearlyCta={
          limits.plan === "yearly" && limits.active ? undefined : (
            <CheckoutButton plan="yearly" label={d.pricing.cta} highlighted />
          )
        }
      />

      {events.length > 0 && (
        <section className="card mt-8 overflow-hidden">
          <h2 className="border-b border-white/8 px-5 py-4 text-[15px] font-semibold">سجل الفوترة</h2>
          <ul className="divide-y divide-white/6">
            {events.map((event) => (
              <li key={event.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3">
                <span className="text-[13px] text-mist-300">{event.kind}</span>
                <span className="text-[12px] text-mist-500">{event.detail}</span>
                <span className="text-[12px] text-mist-500">{formatDate(event.created_at)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
