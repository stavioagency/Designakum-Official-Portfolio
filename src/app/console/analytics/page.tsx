import Link from "next/link";
import type { Metadata } from "next";
import {
  churnRate,
  conversionRate,
  eventSeries,
  eventTotal,
  registrationSeries,
  revenueSnapshot,
  seriesTotal,
  subscriptionSeries,
  topPortfolios,
  uniqueVisitorSeries,
  uniqueVisitorTotal,
} from "@/lib/analytics";
import { can, guardPage } from "@/lib/permissions";
import { brandAsset } from "@/lib/brand";
import { Riyal } from "@/components/riyal";
import {
  BarSeries,
  EmptyState,
  PageHeader,
  SectionCard,
  StatCard,
  Tabs,
  money,
  nf,
} from "@/components/console/ui";
import { BarChart, Eye, ExternalLink, Users, Whatsapp } from "@/components/icons";

export const metadata: Metadata = { title: "التحليلات" };
export const dynamic = "force-dynamic";

const RANGES = [
  { key: "7", label: "7 أيام" },
  { key: "30", label: "30 يومًا" },
  { key: "90", label: "90 يومًا" },
];

type Search = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const staff = await guardPage("analytics.view");
  const params = await searchParams;

  const rangeKey = RANGES.some((r) => r.key === one(params.range)) ? one(params.range)! : "30";
  const days = Number(rangeKey);

  const views = await eventSeries("view", days);
  const visitors = await uniqueVisitorSeries(days);
  const signups = await registrationSeries(days);
  const subscriptions = await subscriptionSeries(days);

  const whatsapp = await eventTotal("whatsapp", days);
  const social = await eventTotal("social", days);
  const projects = await eventTotal("project", days);

  const revenue = await revenueSnapshot();
  const churn = await churnRate(days);
  const conversion = await conversionRate();
  const top = await topPortfolios(8, days);
  const riyalSrc = brandAsset("riyal");

  const totalViews = seriesTotal(views);
  const hasTraffic = totalViews > 0 || whatsapp > 0 || social > 0;

  return (
    <>
      <PageHeader
        title="التحليلات"
        description="أرقام حقيقية من نشاط المعارض والحسابات على المنصة."
      />

      <div className="mb-4">
        <Tabs
          current={rangeKey}
          build={(key) => (key === "30" ? "/console/analytics" : `/console/analytics?range=${key}`)}
          tabs={RANGES.map((range) => ({ key: range.key, label: range.label }))}
        />
      </div>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="مشاهدات المعارض"
          value={nf.format(totalViews)}
          icon={<Eye className="h-4 w-4" />}
          tone="accent"
          series={views}
        />
        <StatCard
          label="زوار مختلفون"
          value={nf.format(await uniqueVisitorTotal(days))}
          hint="تُحتسب مرة واحدة لكل زائر يوميًا"
          icon={<Users className="h-4 w-4" />}
          series={visitors}
        />
        <StatCard
          label="نقرات واتساب"
          value={nf.format(whatsapp)}
          hint={`${nf.format(social)} نقرة على روابط التواصل`}
          icon={<Whatsapp className="h-4 w-4" />}
          tone="good"
        />
        <StatCard
          label="نقرات الأعمال"
          value={nf.format(projects)}
          hint="فتح مشروع من بطاقات المعرض"
          icon={<BarChart className="h-4 w-4" />}
        />
      </section>

      <section className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="تسجيلات جديدة" value={nf.format(seriesTotal(signups))} series={signups} />
        <StatCard
          label="اشتراكات جديدة"
          value={nf.format(seriesTotal(subscriptions))}
          series={subscriptions}
          tone="good"
        />
        <StatCard
          label="نسبة التحويل"
          value={`${conversion.percent.toFixed(1)}%`}
          hint={`${nf.format(conversion.converted)} من ${nf.format(conversion.total)} عميل`}
        />
        <StatCard
          label="التسرب"
          value={`${churn.percent.toFixed(1)}%`}
          hint={`${nf.format(churn.lost)} خلال ${days} يومًا`}
          tone={churn.percent > 10 ? "bad" : "neutral"}
        />
      </section>

      {can(staff, "billing.manage") && (
        <section className="mt-4 grid gap-4 sm:grid-cols-3">
          <div className="card p-5">
            <p className="text-[12.5px] text-mist-400">الإيراد الشهري المتكرر</p>
            <p className="mt-2 flex items-baseline gap-2">
              <span className="tnum text-[28px] font-bold leading-none">{money(revenue.mrr)}</span>
              <Riyal src={riyalSrc} size="1rem" />
            </p>
          </div>
          <div className="card p-5">
            <p className="text-[12.5px] text-mist-400">توزيع الباقات</p>
            <p className="tnum mt-2 text-[28px] font-bold leading-none">
              {nf.format(revenue.monthlyCount)} / {nf.format(revenue.yearlyCount)}
            </p>
            <p className="mt-2 text-[11.5px] text-mist-500">شهري / سنوي</p>
          </div>
          <div className="card p-5">
            <p className="text-[12.5px] text-mist-400">اشتراكات ممنوحة</p>
            <p className="tnum mt-2 text-[28px] font-bold leading-none">
              {nf.format(revenue.compedCount)}
            </p>
            <p className="mt-2 text-[11.5px] text-mist-500">لا تُحتسب ضمن الإيراد</p>
          </div>
        </section>
      )}

      <div className="mt-6 grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <SectionCard title={`المشاهدات خلال ${days} يومًا`}>
          <div className="p-5">
            {hasTraffic ? (
              <BarSeries series={views} height={160} />
            ) : (
              <EmptyState
                icon={<Eye className="h-5 w-5" />}
                title="لا بيانات بعد"
                body="تبدأ الأرقام بالتراكم فور زيارة أول شخص لمعرض منشور."
              />
            )}
          </div>
        </SectionCard>

        <SectionCard title="الأكثر مشاهدة" description={`خلال ${days} يومًا`}>
          {top.length === 0 || top.every((p) => p.views === 0) ? (
            <EmptyState title="لا مشاهدات في هذه الفترة" />
          ) : (
            <ul className="divide-y divide-white/6">
              {top.map((portfolio, index) => (
                <li key={portfolio.id} className="flex items-center gap-3 px-5 py-3">
                  <span className="tnum w-5 text-[12px] text-mist-600">{index + 1}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px]">{portfolio.name}</span>
                    <span dir="ltr" className="block truncate text-start text-[11px] text-mist-500">
                      /p/{portfolio.slug}
                    </span>
                  </span>
                  <span className="tnum text-[13px] font-semibold">{nf.format(portfolio.views)}</span>
                  <Link
                    href={`/p/${portfolio.slug}`}
                    target="_blank"
                    aria-label="فتح المعرض"
                    className="icon-btn !h-8 !w-8"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>
    </>
  );
}
