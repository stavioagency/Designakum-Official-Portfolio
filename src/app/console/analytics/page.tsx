import Link from "next/link";
import { currentLocale } from "@/lib/locale";
import { dict, fill } from "@/lib/i18n";
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

export async function generateMetadata(): Promise<Metadata> {
  return { title: dict(await currentLocale()).console.analytics.title };
}
export const dynamic = "force-dynamic";

const RANGES = [
  { key: "7" },
  { key: "30" },
  { key: "90" },
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
  const locale = await currentLocale();
  const t = dict(locale).console.analytics;
  const top = await topPortfolios(8, days);
  const riyalSrc = brandAsset("riyal");

  const totalViews = seriesTotal(views);
  const hasTraffic = totalViews > 0 || whatsapp > 0 || social > 0;

  return (
    <>
      <PageHeader
        title={t.title}
        description={t.description}
      />

      <div className="mb-4">
        <Tabs
          current={rangeKey}
          build={(key) => (key === "30" ? "/console/analytics" : `/console/analytics?range=${key}`)}
          tabs={RANGES.map((range) => ({
            key: range.key,
            label: t[`days${range.key}` as "days7" | "days30" | "days90"],
          }))}
        />
      </div>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={t.views}
          value={nf.format(totalViews)}
          icon={<Eye className="h-4 w-4" />}
          tone="accent"
          series={views}
        />
        <StatCard
          label={t.uniqueVisitors}
          value={nf.format(await uniqueVisitorTotal(days))}
          hint={t.uniqueHint}
          icon={<Users className="h-4 w-4" />}
          series={visitors}
        />
        <StatCard
          label={t.whatsappClicks}
          value={nf.format(whatsapp)}
          hint={fill(t.socialHint, { n: nf.format(social) })}
          icon={<Whatsapp className="h-4 w-4" />}
          tone="good"
        />
        <StatCard
          label={t.projectClicks}
          value={nf.format(projects)}
          hint={t.projectHint}
          icon={<BarChart className="h-4 w-4" />}
        />
      </section>

      <section className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label={t.newSignups} value={nf.format(seriesTotal(signups))} series={signups} />
        <StatCard
          label={t.newSubscriptions}
          value={nf.format(seriesTotal(subscriptions))}
          series={subscriptions}
          tone="good"
        />
        <StatCard
          label={t.conversion}
          value={`${conversion.percent.toFixed(1)}%`}
          hint={fill(t.conversionHint, {
            converted: nf.format(conversion.converted),
            total: nf.format(conversion.total),
          })}
        />
        <StatCard
          label={t.churn}
          value={`${churn.percent.toFixed(1)}%`}
          hint={fill(t.churnHint, { lost: nf.format(churn.lost), days })}
          tone={churn.percent > 10 ? "bad" : "neutral"}
        />
      </section>

      {can(staff, "billing.manage") && (
        <section className="mt-4 grid gap-4 sm:grid-cols-3">
          <div className="card p-5">
            <p className="text-[12.5px] text-mist-400">{t.mrr}</p>
            <p className="mt-2 flex items-baseline gap-2">
              <span className="tnum text-[28px] font-bold leading-none">{money(revenue.mrr)}</span>
              <Riyal src={riyalSrc} size="1rem" />
            </p>
          </div>
          <div className="card p-5">
            <p className="text-[12.5px] text-mist-400">{t.planSplit}</p>
            <p className="tnum mt-2 text-[28px] font-bold leading-none">
              {nf.format(revenue.monthlyCount)} / {nf.format(revenue.yearlyCount)}
            </p>
            <p className="mt-2 text-[11.5px] text-mist-500">{t.planSplitHint}</p>
          </div>
          <div className="card p-5">
            <p className="text-[12.5px] text-mist-400">{t.comped}</p>
            <p className="tnum mt-2 text-[28px] font-bold leading-none">
              {nf.format(revenue.compedCount)}
            </p>
            <p className="mt-2 text-[11.5px] text-mist-500">{t.compedHint}</p>
          </div>
        </section>
      )}

      <div className="mt-6 grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <SectionCard title={fill(t.viewsOverDays, { days })}>
          <div className="p-5">
            {hasTraffic ? (
              <BarSeries series={views} height={160} />
            ) : (
              <EmptyState
                icon={<Eye className="h-5 w-5" />}
                title={t.noData}
                body={t.noDataBody}
              />
            )}
          </div>
        </SectionCard>

        <SectionCard title={t.topViewed} description={fill(t.overDays, { days })}>
          {top.length === 0 || top.every((p) => p.views === 0) ? (
            <EmptyState title={t.noViewsInPeriod} />
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
                    aria-label={t.openPortfolio}
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
