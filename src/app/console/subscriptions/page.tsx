import Link from "next/link";
import { currentLocale } from "@/lib/locale";
import { dict, fill } from "@/lib/i18n";
import type { Metadata } from "next";
import { all, get } from "@/lib/db";
import { billingConfigured, planDefinitions, yearlySaving } from "@/lib/billing";
import { conversionRate, churnRate, revenueSnapshot } from "@/lib/analytics";
import { guardPage } from "@/lib/permissions";
import { brandAsset } from "@/lib/brand";
import { Riyal } from "@/components/riyal";
import {
  Badge,
  EmptyState,
  PageHeader,
  Pagination,
  SectionCard,
  StatCard,
  Tabs,
  formatDate,
  formatDateTime,
  money,
  nf,
} from "@/components/console/ui";
import { CreditCard, Wallet } from "@/components/icons";

export async function generateMetadata(): Promise<Metadata> {
  return { title: dict(await currentLocale()).console.subscriptions.title };
}
export const dynamic = "force-dynamic";

const PER_PAGE = 50;

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
  const page = Math.max(1, Number(one(params.page)) || 1);

  const plans = await planDefinitions();
  const saving = await yearlySaving();
  const revenue = await revenueSnapshot();
  const churn = await churnRate(30);
  const conversion = await conversionRate();
  const riyalSrc = brandAsset("riyal");
  const locale = await currentLocale();
  const c = dict(locale).console;
  const t = c.subscriptions;
  const statusLabel: Record<string, string> = t.status;
  const sourceLabel: Record<string, string> = t.source;

  const where =
    filter === "all"
      ? ""
      : filter === "ended"
        ? "WHERE s.status IN ('canceled','expired')"
        : "WHERE s.status = 'active'";

  // Paged rather than a bare LIMIT: the old query silently hid everything past
  // the hundredth subscription, which is exactly the point at which the platform
  // would be worth looking at.
  const rows = await all<SubscriptionRow>(
    `SELECT s.*, u.email, u.display_name
       FROM subscriptions s JOIN users u ON u.id = s.user_id
       ${where}
      ORDER BY s.created_at DESC
      LIMIT ? OFFSET ?`,
    PER_PAGE,
    (page - 1) * PER_PAGE,
  );

  const total =
    (await get<{ n: number }>(
      `SELECT COUNT(*) AS n FROM subscriptions s JOIN users u ON u.id = s.user_id ${where}`,
    ))?.n ?? 0;

  const buildPage = (next: number) => {
    const query = new URLSearchParams();
    if (filter !== "active") query.set("status", filter);
    if (next > 1) query.set("page", String(next));
    const qs = query.toString();
    return qs ? `/console/subscriptions?${qs}` : "/console/subscriptions";
  };

  return (
    <>
      <PageHeader
        title={t.title}
        description={t.description}
        actions={
          <Badge tone={billingConfigured() ? "good" : "warn"}>
            {billingConfigured() ? t.providerLinked : t.noProvider}
          </Badge>
        }
      />

      <section className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={t.mrr}
          value={money(revenue.mrr)}
          hint={fill(t.arrHint, { arr: money(revenue.arr) })}
          icon={<Wallet className="h-4 w-4" />}
          tone="accent"
        />
        <StatCard
          label={t.paidSubscriptions}
          value={nf.format(revenue.paidCount)}
          hint={fill(t.compedHint, { n: nf.format(revenue.compedCount) })}
          icon={<CreditCard className="h-4 w-4" />}
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
          hint={fill(t.churnHint, { n: nf.format(churn.lost) })}
          tone={churn.percent > 10 ? "bad" : "neutral"}
        />
      </section>

      <section className="mb-4 grid gap-4 sm:grid-cols-2">
        <div className="card p-5">
          <p className="text-[12.5px] text-mist-400">{t.monthlyPlan}</p>
          <p className="mt-2 flex items-baseline gap-2">
            <span className="tnum text-[30px] font-bold leading-none">{money(plans.monthly.amount)}</span>
            <Riyal src={riyalSrc} size="1.1rem" />
            <span className="text-[12.5px] text-mist-500">{t.perMonth}</span>
          </p>
          <p className="mt-2 text-[12px] text-mist-500">
            {fill(t.subscriberCount, { n: nf.format(revenue.monthlyPaid) })}
          </p>
        </div>
        <div className="card accent-glow p-5">
          <p className="text-[12.5px] text-mist-400">{t.yearlyPlan}</p>
          <p className="mt-2 flex items-baseline gap-2">
            <span className="tnum text-[30px] font-bold leading-none">{money(plans.yearly.amount)}</span>
            <Riyal src={riyalSrc} size="1.1rem" />
            <span className="text-[12.5px] text-mist-500">{t.perYear}</span>
          </p>
          <p className="accent-text mt-2 text-[12px] font-semibold">
            {fill(t.saving, {
              saved: money(saving.saved),
              full: money(saving.twelveMonths),
              percent: saving.percentLabel,
            })}
          </p>
          <p className="mt-1 text-[12px] text-mist-500">
            {fill(t.subscriberCount, { n: nf.format(revenue.yearlyPaid) })}
          </p>
        </div>
      </section>

      <p className="panel mb-4 px-4 py-3 text-[12.5px] leading-relaxed text-mist-400">
        {t.pricesManaged}{" "}
        <Link
          href="/console/settings"
          className="underline decoration-white/25 underline-offset-4"
        >
          {t.platformSettings}
        </Link>
        .
        {!billingConfigured() &&
          t.noProviderNote}
      </p>

      <div className="mb-4">
        <Tabs
          current={filter}
          build={(key) => (key === "active" ? "/console/subscriptions" : `/console/subscriptions?status=${key}`)}
          tabs={[
            { key: "active", label: t.tabActive },
            { key: "ended", label: t.tabEnded },
            { key: "all", label: c.common.all },
          ]}
        />
      </div>

      <SectionCard title={t.history} description={fill(t.count, { n: nf.format(total) })}>
        {rows.length === 0 ? (
          <EmptyState icon={<CreditCard className="h-5 w-5" />} title={t.empty} />
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
                  {row.plan === "monthly" ? t.monthly : t.yearly}
                </Badge>
                <Badge tone={row.source === "paid" ? "good" : "warn"}>
                  {sourceLabel[row.source] ?? row.source}
                </Badge>
                <Badge tone={row.status === "active" ? "good" : "neutral"}>
                  {statusLabel[row.status] ?? row.status}
                </Badge>

                <span className="tnum flex items-center gap-1 text-[12.5px] text-mist-300">
                  {money(row.amount)}
                  <Riyal src={riyalSrc} size="0.85em" />
                </span>

                <span className="text-[11.5px] text-mist-600">
                  {row.status === "active"
                    ? fill(row.cancel_at_period_end ? t.endsOn : t.renewsOn, {
                        date: formatDate(row.current_period_end, locale),
                      })
                    : formatDateTime(row.canceled_at ?? row.updated_at ?? row.created_at)}
                </span>
              </li>
            ))}
          </ul>
        )}
        <Pagination
          total={total}
          page={page}
          perPage={PER_PAGE}
          build={buildPage}
          labels={{ prev: c.common.prev, next: c.common.next, range: c.common.range }}
        />
      </SectionCard>
    </>
  );
}
