import Link from "next/link";
import { currentLocale } from "@/lib/locale";
import { dict, fill } from "@/lib/i18n";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { activeSubscription, subscriptionHistory, billingEvents, canPublish } from "@/lib/billing";
import { auditForTarget } from "@/lib/audit";
import { getCustomer, portfolioOf } from "@/lib/customers";
import { can, guardPage, roleLabel } from "@/lib/permissions";
import { reportsForPortfolio, reportStatusLabel } from "@/lib/moderation";
import { ticketsForUser } from "@/lib/support";
import { ticketStatusLabel } from "@/lib/support-labels";
import { eventSeries, eventTotal, seriesTotal } from "@/lib/analytics";
import { brandAsset } from "@/lib/brand";
import { Riyal } from "@/components/riyal";
import {
  Badge,
  EmptyState,
  KeyValue,
  PageHeader,
  SectionCard,
  Sparkline,
  formatDate,
  formatDateTime,
  money,
  nf,
  timeAgo,
} from "@/components/console/ui";
import {
  AccountStatusControl,
  DeleteCustomerControl,
  PasswordResetControl,
  PortfolioSuspensionControl,
  SubscriptionControls,
} from "@/components/console/customer-actions";
import { ArrowLeft, ExternalLink, Eye, Flag, LifeBuoy, Whatsapp } from "@/components/icons";
import { REPORT_REASONS } from "@/lib/types";
import { loadBundle } from "@/lib/portfolios";
import { requestOrigin } from "@/lib/origin";
import { Editor } from "@/components/editor/editor";
import { PortfolioView } from "@/components/portfolio-view";

export async function generateMetadata(): Promise<Metadata> {
  return { title: dict(await currentLocale()).console.customerFile.metaTitle };
}
export const dynamic = "force-dynamic";

const REASON_LABEL = Object.fromEntries(REPORT_REASONS.map((r) => [r.value, r.label]));

export default async function CustomerProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const staff = await guardPage("customers.view");
  const { id } = await params;

  const customer = await getCustomer(id);
  if (!customer) notFound();

  const portfolio = await portfolioOf(customer.id);
  const subscription = await activeSubscription(customer.id);
  const history = await subscriptionHistory(customer.id);
  const reports = portfolio ? await reportsForPortfolio(portfolio.id) : [];
  const tickets = await ticketsForUser(customer.id);
  const locale = await currentLocale();
  const c = dict(locale).console;
  const t = c.customerFile;
  const cust = c.customer;
  const dialogChrome = {
    cancel: c.common.cancel,
    pending: c.common.saving,
    confirmParts: [c.common.confirmBefore, c.common.confirmAfter] as [string, string],
  };

  const auditTrail = can(staff, "audit.view") ? await auditForTarget(customer.id, 25) : [];
  const events = can(staff, "billing.manage") ? await billingEvents(customer.id, 8) : [];

  const origin = await requestOrigin();
  const views = portfolio ? await eventSeries("view", 30, portfolio.id) : [];
  const whatsappClicks = portfolio ? await eventTotal("whatsapp", 30, portfolio.id) : 0;
  const socialClicks = portfolio ? await eventTotal("social", 30, portfolio.id) : 0;
  const riyalSrc = brandAsset("riyal");

  return (
    <>
      <Link
        href="/console/customers"
        className="mb-3 inline-flex items-center gap-1.5 text-[12.5px] text-mist-400 transition hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" />
        {t.backToList}
      </Link>

      <PageHeader
        title={portfolio?.name || customer.display_name || customer.email}
        description={customer.email}
        actions={
          <>
            {portfolio && (
              <Link href={`/p/${portfolio.slug}`} target="_blank" className="btn btn-ghost !py-2.5">
                <ExternalLink className="h-4 w-4" />
                {t.publicPortfolio}
              </Link>
            )}
            {customer.status === "suspended" ? (
              <Badge tone="bad">{t.accountSuspended}</Badge>
            ) : portfolio?.suspended === 1 ? (
              <Badge tone="warn">{t.portfolioSuspended}</Badge>
            ) : (
              <Badge tone="good">{t.active}</Badge>
            )}
          </>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,340px)] xl:items-start">
        <div className="min-w-0 space-y-4">
          <SectionCard title={t.accountInfo}>
            <dl className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-3">
              <KeyValue label={t.email}>
                <span dir="ltr">{customer.email}</span>
              </KeyValue>
              <KeyValue label={t.signInMethod}>
                {customer.auth_provider === "google" ? t.viaGoogle : t.viaPassword}
              </KeyValue>
              <KeyValue label={t.role}>{roleLabel(customer.role, locale)}</KeyValue>
              <KeyValue label={t.joinedOn}>{formatDate(customer.created_at, locale)}</KeyValue>
              <KeyValue label={t.lastSeen}>
                {customer.last_seen_at ? timeAgo(customer.last_seen_at, locale) : t.neverSeen}
              </KeyValue>
              <KeyValue label={t.twoFactor}>
                {customer.two_factor_enabled === 1 ? t.enabled : t.disabled}
              </KeyValue>
              <KeyValue label={t.portfolioLink}>
                {portfolio ? <span dir="ltr">/p/{portfolio.slug}</span> : "—"}
              </KeyValue>
              <KeyValue label={t.publishState}>
                {!portfolio ? "—" : portfolio.published === 1 ? t.published : t.draft}
              </KeyValue>
              <KeyValue label={t.totalViews}>{nf.format(portfolio?.views ?? 0)}</KeyValue>
            </dl>
          </SectionCard>

          {portfolio && (
            <SectionCard
              title={t.activity30}
              description={fill(t.viewsCount, { n: nf.format(seriesTotal(views)) })}
            >
              <div className="grid gap-4 p-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                <Sparkline series={views} height={64} />
                <div className="flex gap-3">
                  <div className="panel px-3.5 py-2.5 text-center">
                    <p className="tnum text-[18px] font-bold">{nf.format(whatsappClicks)}</p>
                    <p className="mt-1 flex items-center justify-center gap-1 text-[11px] text-mist-500">
                      <Whatsapp className="h-3.5 w-3.5" />
                      {t.whatsapp}
                    </p>
                  </div>
                  <div className="panel px-3.5 py-2.5 text-center">
                    <p className="tnum text-[18px] font-bold">{nf.format(socialClicks)}</p>
                    <p className="mt-1 flex items-center justify-center gap-1 text-[11px] text-mist-500">
                      <Eye className="h-3.5 w-3.5" />
                      {t.socials}
                    </p>
                  </div>
                </div>
              </div>
            </SectionCard>
          )}

          <SectionCard
            title={t.reports}
            description={fill(t.reportsCount, { n: reports.length })}
            actions={
              reports.length > 0 && (
                <Link href="/console/moderation" className="btn btn-ghost !px-3 !py-1.5 !text-[12.5px]">
                  {t.allReports}
                </Link>
              )
            }
          >
            {reports.length === 0 ? (
              <EmptyState icon={<Flag className="h-5 w-5" />} title={t.noReports} />
            ) : (
              <ul className="divide-y divide-white/6">
                {reports.map(async (report) => (
                  <li key={report.id}>
                    <Link
                      href={`/console/moderation/${report.id}`}
                      className="flex items-center gap-3 px-5 py-3 transition hover:bg-white/[0.03]"
                    >
                      <Badge
                        tone={
                          report.status === "pending"
                            ? "bad"
                            : report.status === "reviewing"
                              ? "warn"
                              : "neutral"
                        }
                      >
                        {reportStatusLabel(report.status, locale)}
                      </Badge>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13.5px]">
                          {REASON_LABEL[report.reason] ?? report.reason}
                        </span>
                        <span className="block truncate text-[11.5px] text-mist-500">
                          {report.description}
                        </span>
                      </span>
                      <span className="shrink-0 text-[11px] text-mist-600">
                        {timeAgo(report.created_at, locale)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          <SectionCard title={t.tickets} description={fill(t.ticketsCount, { n: tickets.length })}>
            {tickets.length === 0 ? (
              <EmptyState icon={<LifeBuoy className="h-5 w-5" />} title={t.noTickets} />
            ) : (
              <ul className="divide-y divide-white/6">
                {tickets.map(async (ticket) => (
                  <li key={ticket.id}>
                    <Link
                      href={`/console/support/${ticket.id}`}
                      className="flex items-center gap-3 px-5 py-3 transition hover:bg-white/[0.03]"
                    >
                      <Badge tone={ticket.status === "resolved" ? "neutral" : "warn"}>
                        {ticketStatusLabel(ticket.status, locale)}
                      </Badge>
                      <span className="min-w-0 flex-1 truncate text-[13.5px]">{ticket.subject}</span>
                      <span className="shrink-0 text-[11px] text-mist-600">
                        {timeAgo(ticket.last_reply_at, locale)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          {can(staff, "audit.view") && (
            <SectionCard title={t.accountLog} description={t.accountLogHint}>
              {auditTrail.length === 0 ? (
                <EmptyState title={t.noActions} />
              ) : (
                <ul className="divide-y divide-white/6">
                  {auditTrail.map(async (entry) => (
                    <li key={entry.id} className="px-5 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <code dir="ltr" className="text-[12px] text-mist-200">{entry.action}</code>
                        <span className="text-[11.5px] text-mist-500">{entry.actor_email}</span>
                        <span className="ms-auto text-[11px] text-mist-600">
                          {formatDateTime(entry.created_at, locale)}
                        </span>
                      </div>
                      {entry.detail && (
                        <p className="mt-1 text-[12px] leading-relaxed text-mist-400">{entry.detail}</p>
                      )}
                      {(entry.before_state || entry.after_state) && (
                        <p dir="ltr" className="mt-1 truncate text-start text-[11px] text-mist-600">
                          {entry.before_state} → {entry.after_state}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>
          )}
        </div>

        {/* ------------------------------------------------------------ actions */}
        <div className="space-y-4">
          <SectionCard title={t.subscription}>
            <div className="space-y-4 p-5">
              <dl className="grid gap-2.5">
                <KeyValue label={t.state}>
                  {subscription ? (
                    <span className="text-emerald-300">
                      {fill(t.activePlan, {
                        plan:
                          subscription.plan === "monthly" ? c.plans.monthly : c.plans.yearly,
                      })}
                    </span>
                  ) : (
                    c.plans.none
                  )}
                </KeyValue>
                {subscription && (
                  <>
                    <KeyValue label={t.source}>
                      {subscription.source === "paid"
                        ? c.sources.paid
                        : subscription.source === "invitation"
                          ? c.sources.invitation
                          : c.sources.manual}
                    </KeyValue>
                    <KeyValue label={t.startedOn}>
                      {formatDateTime(subscription.started_at ?? subscription.created_at, locale)}
                    </KeyValue>
                    <KeyValue label={subscription.cancel_at_period_end ? t.endsOn : t.renewsOn}>
                      {formatDate(subscription.current_period_end, locale)}
                    </KeyValue>
                    <KeyValue label={t.amountCharged}>
                      <span className="flex items-center gap-1.5">
                        {money(subscription.amount)}
                        <Riyal src={riyalSrc} size="0.9em" />
                      </span>
                    </KeyValue>
                  </>
                )}
              </dl>

              {can(staff, "billing.manage") ? (
                <div className="border-t border-white/8 pt-4">
                  <SubscriptionControls
                  copy={cust}
                  dialog={dialogChrome}
                  plans={{ monthly: c.plans.monthly, yearly: c.plans.yearly }}
                    userId={customer.id}
                    hasSubscription={history.length > 0}
                    isActive={Boolean(subscription)}
                  />
                </div>
              ) : (
                <p className="text-[12px] text-mist-500">{t.ownerOnly}</p>
              )}
            </div>
          </SectionCard>

          {history.length > 1 && can(staff, "billing.manage") && (
            <SectionCard title={t.subscriptionHistory}>
              <ul className="divide-y divide-white/6 text-[12.5px]">
                {history.map(async (row) => (
                  <li key={row.id} className="flex items-center justify-between gap-3 px-5 py-2.5">
                    <span>{row.plan === "monthly" ? c.plans.monthly : c.plans.yearly}</span>
                    <Badge tone={row.status === "active" ? "good" : "neutral"}>{row.status}</Badge>
                    <span className="text-[11px] text-mist-600">{formatDate(row.created_at, locale)}</span>
                  </li>
                ))}
              </ul>
            </SectionCard>
          )}

          {events.length > 0 && (
            <SectionCard title={t.billingHistory}>
              <ul className="divide-y divide-white/6 text-[12px]">
                {events.map(async (event) => (
                  <li key={event.id} className="flex items-center justify-between gap-2 px-5 py-2.5">
                    <code dir="ltr" className="text-mist-300">{event.kind}</code>
                    <span className="truncate text-mist-500">{event.detail}</span>
                    <span className="shrink-0 text-[11px] text-mist-600">
                      {formatDateTime(event.created_at, locale)}
                    </span>
                  </li>
                ))}
              </ul>
            </SectionCard>
          )}

          {can(staff, "customers.suspend") && (
            <SectionCard title={t.accountState}>
              <div className="p-5">
                <AccountStatusControl copy={cust} dialog={dialogChrome} pending={c.common.saving}
                  userId={customer.id}
                  email={customer.email}
                  suspended={customer.status === "suspended"}
                />
              </div>
            </SectionCard>
          )}

          {portfolio && can(staff, "moderation.enforce") && (
            <SectionCard title={t.portfolioState}>
              <div className="p-5">
                <PortfolioSuspensionControl copy={cust} dialog={dialogChrome} pending={c.common.saving}
                  portfolioId={portfolio.id}
                  slug={portfolio.slug}
                  suspended={portfolio.suspended === 1}
                  reason={portfolio.suspended_reason}
                />
              </div>
            </SectionCard>
          )}

          {can(staff, "customers.suspend") && (
            <SectionCard title={t.access}>
              <div className="p-5">
                <PasswordResetControl copy={cust} userId={customer.id} />
              </div>
            </SectionCard>
          )}

          {can(staff, "customers.delete") && (
            <SectionCard title={t.dangerZone} className="border-rose-500/20">
              <div className="p-5">
                <DeleteCustomerControl copy={cust} dialog={dialogChrome} userId={customer.id} email={customer.email} />
              </div>
            </SectionCard>
          )}
        </div>
      </div>

      {portfolio && can(staff, "portfolio.edit") && (
        <section className="mt-6">
          <h2 className="mb-4 text-lg font-semibold">{t.editOnBehalf}</h2>
          <p className="panel mb-4 px-4 py-3 text-[12.5px] leading-relaxed text-mist-400">
            {t.editOnBehalfHint}
          </p>
          <Editor
            bundle={await loadBundle(portfolio)}
            user={customer}
            origin={origin}
            preview={<PortfolioView bundle={await loadBundle(portfolio)} />}
            hasPassword={customer.password_hash !== ""}
            canPublish={await canPublish(customer)}
            copy={dict(locale).dashboard}
            passwordCopy={dict(locale).password}
            locale={locale}
          />
        </section>
      )}
    </>
  );
}
