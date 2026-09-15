import Link from "next/link";
import { currentLocale } from "@/lib/locale";
import { dict, fill } from "@/lib/i18n";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getTicket, ticketMessages } from "@/lib/support";
import {
  ticketCategoryLabel,
  ticketPriorityLabel,
  ticketStatusLabel,
} from "@/lib/support-labels";
import { staffMembers } from "@/lib/customers";
import { guardPage } from "@/lib/permissions";
import { activeSubscription } from "@/lib/billing";
import {
  Badge,
  KeyValue,
  PageHeader,
  SectionCard,
  formatDate,
  formatDateTime,
  timeAgo,
} from "@/components/console/ui";
import { StaffReplyForm, TicketControls } from "@/components/console/support-actions";
import { ArrowLeft, Shield } from "@/components/icons";

export async function generateMetadata(): Promise<Metadata> {
  return { title: dict(await currentLocale()).meta.ticket };
}
export const dynamic = "force-dynamic";

export default async function TicketPage({ params }: { params: Promise<{ id: string }> }) {
  await guardPage("support.manage");
  const { id } = await params;

  const ticket = await getTicket(id);
  if (!ticket) notFound();

  // Staff see internal notes; the customer's own view never requests them.
  const messages = await ticketMessages(id, true);
  const locale = await currentLocale();
  const c = dict(locale).console;
  const t = c.tickets;
  const members = (await staffMembers()).map((member) => ({
    id: member.id,
    label: member.display_name || member.email,
  }));
  const subscription = await activeSubscription(ticket.user_id);

  return (
    <>
      <Link
        href="/console/support"
        className="mb-3 inline-flex items-center gap-1.5 text-[12.5px] text-mist-400 transition hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" />
        {t.backToList}
      </Link>

      <PageHeader
        title={ticket.subject}
        description={`${ticketCategoryLabel(ticket.category, locale)} · ${fill(t.openedAgo, {
          ago: timeAgo(ticket.created_at, locale),
        })}`}
        actions={<Badge tone={ticket.status === "resolved" ? "neutral" : "warn"}>
          {ticketStatusLabel(ticket.status, locale)}
        </Badge>}
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,320px)] xl:items-start">
        <div className="min-w-0 space-y-4">
          <SectionCard title={t.conversation}>
            <ul className="space-y-3 p-5">
              {messages.map((message) => {
                const staffSide = message.author_side === "staff";
                return (
                  <li
                    key={message.id}
                    className={`rounded-2xl border p-4 ${
                      message.internal
                        ? "border-amber-400/25 bg-amber-400/[0.06]"
                        : staffSide
                          ? "border-white/10 bg-white/[0.05]"
                          : "border-white/8 bg-white/[0.02]"
                    }`}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[12.5px] font-semibold">{message.author_name}</span>
                      {staffSide && (
                        <Badge tone="accent">
                          <Shield className="h-3 w-3" />
                          {t.brand}
                        </Badge>
                      )}
                      {message.internal === 1 && <Badge tone="warn">{t.internalNoteBadge}</Badge>}
                      <span className="ms-auto text-[11px] text-mist-600">
                        {formatDateTime(message.created_at, locale)}
                      </span>
                    </div>
                    <p className="mt-2 whitespace-pre-wrap text-[13.5px] leading-[1.9] text-mist-200">
                      {message.body}
                    </p>
                  </li>
                );
              })}
            </ul>
          </SectionCard>

          <SectionCard title={t.reply}>
            <div className="p-5">
              <StaffReplyForm ticketId={ticket.id} copy={t} />
            </div>
          </SectionCard>
        </div>

        <div className="space-y-4">
          <SectionCard title={t.manage}>
            <div className="p-5">
              <TicketControls
            copy={t}
            locale={locale}
                ticketId={ticket.id}
                status={ticket.status}
                priority={ticket.priority}
                assigneeId={ticket.assignee_id}
                staff={members}
              />
            </div>
          </SectionCard>

          <SectionCard title={t.customer}>
            <div className="space-y-2.5 p-5">
              <KeyValue label={t.customerName}>{ticket.customer_name || "—"}</KeyValue>
              <KeyValue label={t.customerEmail}>
                <span dir="ltr">{ticket.customer_email}</span>
              </KeyValue>
              <KeyValue label={t.customerPlan}>
                {subscription
                  ? fill(t.planActive, {
                      plan:
                        subscription.plan === "monthly"
                          ? c.plans.monthly
                          : c.plans.yearly,
                    })
                  : c.plans.none}
              </KeyValue>
              <Link
                href={`/console/customers/${ticket.user_id}`}
                className="btn btn-ghost mt-1 w-full !py-2 !text-[13px]"
              >
                {t.openCustomer}
              </Link>
            </div>
          </SectionCard>
        </div>
      </div>
    </>
  );
}
