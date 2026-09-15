import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { activeSubscription, subscriptionHistory, billingEvents, canPublish } from "@/lib/billing";
import { auditForTarget } from "@/lib/audit";
import { getCustomer, portfolioOf } from "@/lib/customers";
import { can, guardPage, ROLE_LABEL } from "@/lib/permissions";
import { reportsForPortfolio, REPORT_STATUS_LABEL } from "@/lib/moderation";
import { ticketsForUser, TICKET_STATUS_LABEL } from "@/lib/support";
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

export const metadata: Metadata = { title: "ملف عميل" };
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
        كل العملاء
      </Link>

      <PageHeader
        title={portfolio?.name || customer.display_name || customer.email}
        description={customer.email}
        actions={
          <>
            {portfolio && (
              <Link href={`/p/${portfolio.slug}`} target="_blank" className="btn btn-ghost !py-2.5">
                <ExternalLink className="h-4 w-4" />
                المعرض العام
              </Link>
            )}
            {customer.status === "suspended" ? (
              <Badge tone="bad">حساب موقوف</Badge>
            ) : portfolio?.suspended === 1 ? (
              <Badge tone="warn">معرض موقوف</Badge>
            ) : (
              <Badge tone="good">نشط</Badge>
            )}
          </>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,340px)] xl:items-start">
        <div className="min-w-0 space-y-4">
          <SectionCard title="معلومات الحساب">
            <dl className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-3">
              <KeyValue label="البريد الإلكتروني">
                <span dir="ltr">{customer.email}</span>
              </KeyValue>
              <KeyValue label="طريقة الدخول">
                {customer.auth_provider === "google" ? "حساب جوجل" : "بريد وكلمة مرور"}
              </KeyValue>
              <KeyValue label="الدور">{ROLE_LABEL[customer.role]}</KeyValue>
              <KeyValue label="تاريخ التسجيل">{formatDate(customer.created_at)}</KeyValue>
              <KeyValue label="آخر ظهور">
                {customer.last_seen_at ? timeAgo(customer.last_seen_at) : "لم يدخل بعد"}
              </KeyValue>
              <KeyValue label="التحقق بخطوتين">
                {customer.two_factor_enabled === 1 ? "مفعّل" : "غير مفعّل"}
              </KeyValue>
              <KeyValue label="رابط المعرض">
                {portfolio ? <span dir="ltr">/p/{portfolio.slug}</span> : "—"}
              </KeyValue>
              <KeyValue label="حالة النشر">
                {!portfolio ? "—" : portfolio.published === 1 ? "منشور" : "مسودة"}
              </KeyValue>
              <KeyValue label="إجمالي المشاهدات">{nf.format(portfolio?.views ?? 0)}</KeyValue>
            </dl>
          </SectionCard>

          {portfolio && (
            <SectionCard
              title="نشاط المعرض — 30 يومًا"
              description={`${nf.format(seriesTotal(views))} مشاهدة`}
            >
              <div className="grid gap-4 p-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                <Sparkline series={views} height={64} />
                <div className="flex gap-3">
                  <div className="panel px-3.5 py-2.5 text-center">
                    <p className="tnum text-[18px] font-bold">{nf.format(whatsappClicks)}</p>
                    <p className="mt-1 flex items-center justify-center gap-1 text-[11px] text-mist-500">
                      <Whatsapp className="h-3.5 w-3.5" />
                      واتساب
                    </p>
                  </div>
                  <div className="panel px-3.5 py-2.5 text-center">
                    <p className="tnum text-[18px] font-bold">{nf.format(socialClicks)}</p>
                    <p className="mt-1 flex items-center justify-center gap-1 text-[11px] text-mist-500">
                      <Eye className="h-3.5 w-3.5" />
                      روابط
                    </p>
                  </div>
                </div>
              </div>
            </SectionCard>
          )}

          <SectionCard
            title="البلاغات"
            description={`${reports.length} بلاغ على هذا المعرض`}
            actions={
              reports.length > 0 && (
                <Link href="/console/moderation" className="btn btn-ghost !px-3 !py-1.5 !text-[12.5px]">
                  قائمة البلاغات
                </Link>
              )
            }
          >
            {reports.length === 0 ? (
              <EmptyState icon={<Flag className="h-5 w-5" />} title="لا بلاغات على هذا العميل" />
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
                        {REPORT_STATUS_LABEL[report.status]}
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
                        {timeAgo(report.created_at)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          <SectionCard title="تذاكر الدعم" description={`${tickets.length} تذكرة`}>
            {tickets.length === 0 ? (
              <EmptyState icon={<LifeBuoy className="h-5 w-5" />} title="لا تذاكر من هذا العميل" />
            ) : (
              <ul className="divide-y divide-white/6">
                {tickets.map(async (ticket) => (
                  <li key={ticket.id}>
                    <Link
                      href={`/console/support/${ticket.id}`}
                      className="flex items-center gap-3 px-5 py-3 transition hover:bg-white/[0.03]"
                    >
                      <Badge tone={ticket.status === "resolved" ? "neutral" : "warn"}>
                        {TICKET_STATUS_LABEL[ticket.status]}
                      </Badge>
                      <span className="min-w-0 flex-1 truncate text-[13.5px]">{ticket.subject}</span>
                      <span className="shrink-0 text-[11px] text-mist-600">
                        {timeAgo(ticket.last_reply_at)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          {can(staff, "audit.view") && (
            <SectionCard title="سجل الحساب" description="كل إجراء نُفّذ على هذا العميل">
              {auditTrail.length === 0 ? (
                <EmptyState title="لا إجراءات مسجّلة بعد" />
              ) : (
                <ul className="divide-y divide-white/6">
                  {auditTrail.map(async (entry) => (
                    <li key={entry.id} className="px-5 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <code dir="ltr" className="text-[12px] text-mist-200">{entry.action}</code>
                        <span className="text-[11.5px] text-mist-500">{entry.actor_email}</span>
                        <span className="ms-auto text-[11px] text-mist-600">
                          {formatDate(entry.created_at, true)}
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
          <SectionCard title="الاشتراك">
            <div className="space-y-4 p-5">
              <dl className="grid gap-2.5">
                <KeyValue label="الحالة">
                  {subscription ? (
                    <span className="text-emerald-300">
                      نشط · {subscription.plan === "monthly" ? "شهري" : "سنوي"}
                    </span>
                  ) : (
                    "بدون اشتراك"
                  )}
                </KeyValue>
                {subscription && (
                  <>
                    <KeyValue label="المصدر">
                      {subscription.source === "paid"
                        ? "مدفوع"
                        : subscription.source === "invitation"
                          ? "دعوة مجانية"
                          : "ممنوح يدويًا"}
                    </KeyValue>
                    <KeyValue label="بدأ في">{formatDateTime(subscription.started_at ?? subscription.created_at)}</KeyValue>
                    <KeyValue label={subscription.cancel_at_period_end ? "ينتهي في" : "يتجدد في"}>
                      {formatDate(subscription.current_period_end)}
                    </KeyValue>
                    <KeyValue label="المبلغ المحصّل">
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
                    userId={customer.id}
                    hasSubscription={history.length > 0}
                    isActive={Boolean(subscription)}
                  />
                </div>
              ) : (
                <p className="text-[12px] text-mist-500">إدارة الاشتراكات متاحة لمالك المنصة فقط.</p>
              )}
            </div>
          </SectionCard>

          {history.length > 1 && can(staff, "billing.manage") && (
            <SectionCard title="سجل الاشتراكات">
              <ul className="divide-y divide-white/6 text-[12.5px]">
                {history.map(async (row) => (
                  <li key={row.id} className="flex items-center justify-between gap-3 px-5 py-2.5">
                    <span>{row.plan === "monthly" ? "شهري" : "سنوي"}</span>
                    <Badge tone={row.status === "active" ? "good" : "neutral"}>{row.status}</Badge>
                    <span className="text-[11px] text-mist-600">{formatDate(row.created_at)}</span>
                  </li>
                ))}
              </ul>
            </SectionCard>
          )}

          {events.length > 0 && (
            <SectionCard title="سجل الفوترة">
              <ul className="divide-y divide-white/6 text-[12px]">
                {events.map(async (event) => (
                  <li key={event.id} className="flex items-center justify-between gap-2 px-5 py-2.5">
                    <code dir="ltr" className="text-mist-300">{event.kind}</code>
                    <span className="truncate text-mist-500">{event.detail}</span>
                    <span className="shrink-0 text-[11px] text-mist-600">
                      {formatDateTime(event.created_at)}
                    </span>
                  </li>
                ))}
              </ul>
            </SectionCard>
          )}

          {can(staff, "customers.suspend") && (
            <SectionCard title="حالة الحساب">
              <div className="p-5">
                <AccountStatusControl
                  userId={customer.id}
                  email={customer.email}
                  suspended={customer.status === "suspended"}
                />
              </div>
            </SectionCard>
          )}

          {portfolio && can(staff, "moderation.enforce") && (
            <SectionCard title="حالة المعرض">
              <div className="p-5">
                <PortfolioSuspensionControl
                  portfolioId={portfolio.id}
                  slug={portfolio.slug}
                  suspended={portfolio.suspended === 1}
                  reason={portfolio.suspended_reason}
                />
              </div>
            </SectionCard>
          )}

          {can(staff, "customers.suspend") && (
            <SectionCard title="الدخول">
              <div className="p-5">
                <PasswordResetControl userId={customer.id} />
              </div>
            </SectionCard>
          )}

          {can(staff, "customers.delete") && (
            <SectionCard title="منطقة الخطر" className="border-rose-500/20">
              <div className="p-5">
                <DeleteCustomerControl userId={customer.id} email={customer.email} />
              </div>
            </SectionCard>
          )}
        </div>
      </div>

      {portfolio && can(staff, "portfolio.edit") && (
        <section className="mt-6">
          <h2 className="mb-4 text-lg font-semibold">تحرير المعرض نيابة عن العميل</h2>
          <p className="panel mb-4 px-4 py-3 text-[12.5px] leading-relaxed text-mist-400">
            كل تعديل هنا يُحفظ باسم العميل مباشرة في صفحته العامة. استخدمه للمساعدة عند الطلب فقط.
          </p>
          <Editor
            bundle={await loadBundle(portfolio)}
            user={customer}
            origin={origin}
            preview={<PortfolioView bundle={await loadBundle(portfolio)} />}
            hasPassword={customer.password_hash !== ""}
            canPublish={await canPublish(customer)}
          />
        </section>
      )}
    </>
  );
}
