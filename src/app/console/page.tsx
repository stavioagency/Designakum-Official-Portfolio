import Link from "next/link";
import { currentLocale } from "@/lib/locale";
import { dict, fill } from "@/lib/i18n";
import { currentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { platformStats, recentActivity } from "@/lib/console-stats";
import {
  eventSeries,
  registrationSeries,
  seriesTotal,
  uniqueVisitorSeries,
} from "@/lib/analytics";
import { brandAsset } from "@/lib/brand";
import { Riyal } from "@/components/riyal";
import {
  Badge,
  EmptyState,
  PageHeader,
  SectionCard,
  StatCard,
  money,
  nf,
  timeAgo,
} from "@/components/console/ui";
import {
  Ban,
  Bell,
  CreditCard,
  Eye,
  Flag,
  Gift,
  LifeBuoy,
  Sparkle,
  Users,
  Wallet,
} from "@/components/icons";
import type { ActivityKind } from "@/lib/console-stats";

export const dynamic = "force-dynamic";

const ACTIVITY_TONE: Record<ActivityKind, "neutral" | "good" | "warn" | "bad" | "accent"> = {
  signup: "accent",
  subscription: "good",
  report: "bad",
  ticket: "warn",
  audit: "neutral",
};

export default async function ConsoleDashboard({
  searchParams,
}: {
  searchParams: Promise<{ denied?: string }>;
}) {
  const user = (await currentUser())!;
  const { denied } = await searchParams;
  const stats = await platformStats();
  const locale = await currentLocale();
  const t = dict(locale).console.overview;
  const activity = await recentActivity(14);
  const riyalSrc = brandAsset("riyal");

  const views = await eventSeries("view", 30);
  const visitors = await uniqueVisitorSeries(30);
  const signups = await registrationSeries(30);
  const showRevenue = can(user, "billing.manage");

  return (
    <>
      <PageHeader
        title={t.title}
        description={t.description}
        actions={
          <>
            {stats.pendingReports > 0 && can(user, "moderation.review") && (
              <Link href="/console/moderation" className="btn btn-ghost !py-2.5">
                <Flag className="h-4 w-4" />
                {fill(t.pendingReports, { n: stats.pendingReports })}
              </Link>
            )}
            {stats.openTickets > 0 && can(user, "support.manage") && (
              <Link href="/console/support" className="btn btn-ghost !py-2.5">
                <LifeBuoy className="h-4 w-4" />
                {fill(t.openTickets, { n: stats.openTickets })}
              </Link>
            )}
          </>
        }
      />

      {denied && (
        <p className="panel mb-4 flex items-center gap-2.5 px-4 py-3 text-[13px] text-amber-200">
          <Ban className="h-4 w-4 shrink-0" />
          {t.denied[denied as keyof typeof t.denied]
            ? fill(t.deniedSection, { section: t.denied[denied as keyof typeof t.denied] })
            : t.deniedGeneric}
        </p>
      )}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={t.totalCustomers}
          value={nf.format(stats.totalUsers)}
          hint={fill(t.newIn30, { n: nf.format(stats.newThisMonth) })}
          icon={<Users className="h-4 w-4" />}
          tone="accent"
          href="/console/customers"
          series={signups}
        />
        <StatCard
          label={t.activeCustomers}
          value={nf.format(stats.activeUsers)}
          hint={t.activeHint}
          icon={<Sparkle className="h-4 w-4" />}
          tone="good"
        />
        <StatCard
          label={t.activeSubscriptions}
          value={nf.format(stats.activeSubscriptions)}
          hint={fill(t.planSplit, {
            monthly: nf.format(stats.monthlySubscribers),
            yearly: nf.format(stats.yearlySubscribers),
          })}
          icon={<CreditCard className="h-4 w-4" />}
          tone="good"
          href={can(user, "billing.manage") ? "/console/subscriptions" : undefined}
        />
        {showRevenue ? (
          <StatCard
            label={t.mrr}
            value={
              <span className="inline-flex items-baseline gap-1.5">
                {money(stats.mrr)}
                <Riyal src={riyalSrc} size="0.62em" />
              </span>
            }
            hint={fill(t.mrrHint, {
              arr: money(stats.arr),
              churn: stats.churnPercent.toFixed(1),
            })}
            icon={<Wallet className="h-4 w-4" />}
            tone="accent"
          />
        ) : (
          <StatCard
            label={t.publishedPortfolios}
            value={`${nf.format(stats.publishedPortfolios)}/${nf.format(stats.totalPortfolios)}`}
            icon={<Eye className="h-4 w-4" />}
          />
        )}
      </section>

      <section className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={t.unsubscribed}
          value={nf.format(stats.freeUsers)}
          hint={fill(t.compedHint, { n: nf.format(stats.compedSubscribers) })}
          icon={<Gift className="h-4 w-4" />}
        />
        <StatCard
          label={t.suspendedAccounts}
          value={nf.format(stats.suspendedUsers)}
          hint={fill(t.suspendedHint, { n: nf.format(stats.suspendedPortfolios) })}
          icon={<Ban className="h-4 w-4" />}
          tone={stats.suspendedUsers > 0 ? "bad" : "neutral"}
        />
        <StatCard
          label={t.endedSubscriptions}
          value={nf.format(stats.endedSubscriptions)}
          icon={<CreditCard className="h-4 w-4" />}
          tone={stats.endedSubscriptions > 0 ? "warn" : "neutral"}
        />
        <StatCard
          label={t.openQueues}
          value={nf.format(stats.pendingReports + stats.openTickets)}
          hint={fill(t.openQueuesHint, {
            reports: nf.format(stats.pendingReports),
            tickets: nf.format(stats.openTickets),
          })}
          icon={<Bell className="h-4 w-4" />}
          tone={stats.pendingReports + stats.openTickets > 0 ? "warn" : "neutral"}
        />
      </section>

      <div className="mt-6 grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <SectionCard
          title={t.traffic}
          description={fill(t.trafficHint, {
            views: nf.format(seriesTotal(views)),
            visitors: nf.format(seriesTotal(visitors)),
          })}
          actions={
            can(user, "analytics.view") && (
              <Link href="/console/analytics" className="btn btn-ghost !px-3 !py-1.5 !text-[12.5px]">
                {t.toAnalytics}
              </Link>
            )
          }
        >
          <div className="p-5">
            {seriesTotal(views) === 0 ? (
              <EmptyState
                icon={<Eye className="h-5 w-5" />}
                title={t.noViewsTitle}
                body={t.noViewsBody}
              />
            ) : (
              <>
                <div className="flex items-end gap-[3px]" style={{ height: 150 }} dir="ltr">
                  {views.map((point, index) => {
                    const max = Math.max(1, ...views.map((v) => v.value));
                    const unique = visitors[index]?.value ?? 0;
                    return (
                      <div key={point.day} className="group relative flex-1">
                        <div
                          className="w-full rounded-t-[3px] bg-white/[0.08]"
                          style={{ height: Math.max(2, (point.value / max) * 150) }}
                        >
                          <div
                            className="accent-grad w-full rounded-t-[3px]"
                            style={{
                              height: `${point.value ? (unique / point.value) * 100 : 0}%`,
                            }}
                          />
                        </div>
                        <span className="glass pointer-events-none absolute bottom-full left-1/2 z-10 mb-1.5 hidden -translate-x-1/2 whitespace-nowrap rounded-lg px-2 py-1 text-[10.5px] group-hover:block">
                          {fill(t.pointTooltip, {
                            day: point.day,
                            views: point.value,
                            visitors: unique,
                          })}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-3 flex items-center gap-4 text-[11.5px] text-mist-500">
                  <span className="flex items-center gap-1.5">
                    <span className="accent-grad h-2.5 w-2.5 rounded-sm" />
                    {t.uniqueVisitors}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-sm bg-white/[0.12]" />
                    {t.totalViews}
                  </span>
                </div>
              </>
            )}
          </div>
        </SectionCard>

        <SectionCard title={t.recent} description={t.recentHint}>
          {activity.length === 0 ? (
            <EmptyState title={t.noActivityTitle} body={t.noActivityBody} />
          ) : (
            <ul className="divide-y divide-white/6">
              {activity.map((item) => {
                // The queries return the bare fact (a plan name, a portfolio
                // name); the sentence around it is written here, in the reader's
                // language, rather than in SQL.
                const title =
                  item.kind === "subscription"
                    ? t.activity[item.title === "yearly" ? "yearly" : "monthly"]
                    : item.kind === "report"
                      ? fill(t.activity.report, { name: item.title })
                      : item.title;
                const row = (
                  <>
                    <Badge tone={ACTIVITY_TONE[item.kind]}>{t.kind[item.kind]}</Badge>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px]">{title}</span>
                      <span className="block truncate text-[11.5px] text-mist-500">{item.detail}</span>
                    </span>
                    <span className="shrink-0 text-[11px] text-mist-600">{timeAgo(item.created_at, locale)}</span>
                  </>
                );
                return (
                  <li key={`${item.kind}-${item.id}`}>
                    {item.href ? (
                      <Link
                        href={item.href}
                        className="flex items-center gap-3 px-5 py-3 transition hover:bg-white/[0.03]"
                      >
                        {row}
                      </Link>
                    ) : (
                      <div className="flex items-center gap-3 px-5 py-3">{row}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </SectionCard>
      </div>

      {showRevenue && (
        <p className="mt-4 flex items-center gap-1.5 text-[12px] text-mist-600">
          {t.currencyNote}
          <Riyal src={riyalSrc} size="0.9em" />
        </p>
      )}
    </>
  );
}
