import Link from "next/link";
import type { Metadata } from "next";
import { all } from "@/lib/db";
import { billingConfigured, planDefinitions, yearlySaving } from "@/lib/billing";
import { conversionRate, churnRate, revenueSnapshot } from "@/lib/analytics";
import { guardPage } from "@/lib/permissions";
import { brandAsset } from "@/lib/brand";
import { Riyal } from "@/components/riyal";
import {
  Badge,
  EmptyState,
  PageHeader,
  SectionCard,
  StatCard,
  Tabs,
  formatDate,
  money,
  nf,
} from "@/components/console/ui";
import { CreditCard, Wallet } from "@/components/icons";

export const metadata: Metadata = { title: "الاشتراكات" };
export const dynamic = "force-dynamic";

interface SubscriptionRow {
  id: string;
  user_id: string;
  email: string;
  display_name: string;
  plan: string;
  status: string;
  source: string;
  amount: number;
  started_at: number | null;
  canceled_at: number | null;
  current_period_end: number | null;
  cancel_at_period_end: number;
  created_at: number;
  updated_at: number;
}

const STATUS_LABEL: Record<string, string> = {
  active: "نشط",
  past_due: "متأخر السداد",
  canceled: "ملغى",
  expired: "منتهٍ",
  incomplete: "غير مكتمل",
};

const SOURCE_LABEL: Record<string, string> = {
  paid: "مدفوع",
  manual: "ممنوح يدويًا",
  invitation: "دعوة مجانية",
};

type Search = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function SubscriptionsPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  await guardPage("billing.manage");
  const params = await searchParams;
  const filter = one(params.status) ?? "active";

  const plans = await planDefinitions();
  const saving = await yearlySaving();
  const revenue = await revenueSnapshot();
  const churn = await churnRate(30);
  const conversion = await conversionRate();
  const riyalSrc = brandAsset("riyal");

  const where =
    filter === "all"
      ? ""
      : filter === "ended"
        ? "WHERE s.status IN ('canceled','expired')"
        : "WHERE s.status = 'active'";

  const rows = await all<SubscriptionRow>(
    `SELECT s.*, u.email, u.display_name
       FROM subscriptions s JOIN users u ON u.id = s.user_id
       ${where}
      ORDER BY s.created_at DESC LIMIT 100`,
  );

  return (
    <>
      <PageHeader
        title="الاشتراكات"
        description="الباقات والأسعار وحالة كل اشتراك على المنصة."
        actions={
          <Badge tone={billingConfigured() ? "good" : "warn"}>
            {billingConfigured() ? "مزوّد الدفع مربوط" : "لا يوجد مزوّد دفع"}
          </Badge>
        }
      />

      <section className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="الإيراد الشهري المتكرر"
          value={money(revenue.mrr)}
          hint={`سنويًا ${money(revenue.arr)}`}
          icon={<Wallet className="h-4 w-4" />}
          tone="accent"
        />
        <StatCard
          label="اشتراكات مدفوعة"
          value={nf.format(revenue.paidCount)}
          hint={`${nf.format(revenue.compedCount)} ممنوحة مجانًا`}
          icon={<CreditCard className="h-4 w-4" />}
          tone="good"
        />
        <StatCard
          label="التحويل إلى مشترك"
          value={`${conversion.percent.toFixed(1)}%`}
          hint={`${nf.format(conversion.converted)} من ${nf.format(conversion.total)} عميل`}
        />
        <StatCard
          label="التسرب — 30 يومًا"
          value={`${churn.percent.toFixed(1)}%`}
          hint={`${nf.format(churn.lost)} اشتراك انتهى أو أُلغي`}
          tone={churn.percent > 10 ? "bad" : "neutral"}
        />
      </section>

      <section className="mb-4 grid gap-4 sm:grid-cols-2">
        <div className="card p-5">
          <p className="text-[12.5px] text-mist-400">الباقة الشهرية</p>
          <p className="mt-2 flex items-baseline gap-2">
            <span className="tnum text-[30px] font-bold leading-none">{money(plans.monthly.amount)}</span>
            <Riyal src={riyalSrc} size="1.1rem" />
            <span className="text-[12.5px] text-mist-500">/ شهر</span>
          </p>
          <p className="mt-2 text-[12px] text-mist-500">
            {nf.format(revenue.monthlyCount)} مشترك حالي
          </p>
        </div>
        <div className="card accent-glow p-5">
          <p className="text-[12.5px] text-mist-400">الباقة السنوية</p>
          <p className="mt-2 flex items-baseline gap-2">
            <span className="tnum text-[30px] font-bold leading-none">{money(plans.yearly.amount)}</span>
            <Riyal src={riyalSrc} size="1.1rem" />
            <span className="text-[12.5px] text-mist-500">/ سنة</span>
          </p>
          <p className="accent-text mt-2 text-[12px] font-semibold">
            توفير {money(saving.saved)} مقابل {money(saving.twelveMonths)} ({saving.percentLabel}%)
          </p>
          <p className="mt-1 text-[12px] text-mist-500">
            {nf.format(revenue.yearlyCount)} مشترك حالي
          </p>
        </div>
      </section>

      <p className="panel mb-4 px-4 py-3 text-[12.5px] leading-relaxed text-mist-400">
        الأسعار تُدار من <Link href="/console/settings" className="underline decoration-white/25 underline-offset-4">إعدادات المنصة</Link>.
        {!billingConfigured() &&
          " لم يُربط مزوّد دفع بعد، لذلك لا تتم عمليات الشراء تلقائيًا — يمكنك منح الاشتراكات يدويًا من ملف كل عميل."}
      </p>

      <div className="mb-4">
        <Tabs
          current={filter}
          build={(key) => (key === "active" ? "/console/subscriptions" : `/console/subscriptions?status=${key}`)}
          tabs={[
            { key: "active", label: "النشطة" },
            { key: "ended", label: "المنتهية والملغاة" },
            { key: "all", label: "الكل" },
          ]}
        />
      </div>

      <SectionCard title="سجل الاشتراكات" description="أحدث 100 اشتراك">
        {rows.length === 0 ? (
          <EmptyState icon={<CreditCard className="h-5 w-5" />} title="لا اشتراكات في هذه القائمة" />
        ) : (
          <ul className="divide-y divide-white/6">
            {rows.map((row) => (
              <li key={row.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
                <Link href={`/console/customers/${row.user_id}`} className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] font-semibold">
                    {row.display_name || row.email}
                  </span>
                  <span dir="ltr" className="block truncate text-start text-[11.5px] text-mist-500">
                    {row.email}
                  </span>
                </Link>

                <Badge tone={row.plan === "yearly" ? "accent" : "neutral"}>
                  {row.plan === "monthly" ? "شهري" : "سنوي"}
                </Badge>
                <Badge tone={row.source === "paid" ? "good" : "warn"}>
                  {SOURCE_LABEL[row.source] ?? row.source}
                </Badge>
                <Badge tone={row.status === "active" ? "good" : "neutral"}>
                  {STATUS_LABEL[row.status] ?? row.status}
                </Badge>

                <span className="tnum flex items-center gap-1 text-[12.5px] text-mist-300">
                  {money(row.amount)}
                  <Riyal src={riyalSrc} size="0.85em" />
                </span>

                <span className="text-[11.5px] text-mist-600">
                  {row.status === "active"
                    ? `${row.cancel_at_period_end ? "ينتهي" : "يتجدد"} ${formatDate(row.current_period_end)}`
                    : formatDate(row.canceled_at ?? row.updated_at ?? row.created_at)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </>
  );
}
