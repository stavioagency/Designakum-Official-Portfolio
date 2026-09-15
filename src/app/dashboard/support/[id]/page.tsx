import Link from "next/link";
import type { Metadata } from "next";
import { currentLocale } from "@/lib/locale";
import { dict, fill } from "@/lib/i18n";
import { notFound, redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { getTicket, ticketMessages } from "@/lib/support";
import { ticketCategoryLabel, ticketStatusLabel } from "@/lib/support-labels";
import { Badge, SectionCard, formatDateTime, timeAgo } from "@/components/console/ui";
import { CustomerReplyForm } from "@/components/support/customer-forms";
import { ArrowLeft, Shield } from "@/components/icons";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: dict(await currentLocale()).meta.ticket,
  };
}
export const dynamic = "force-dynamic";

export default async function CustomerTicketPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await currentUser();
  if (!user) redirect("/login");

  const { id } = await params;
  const ticket = await getTicket(id);
  // Tenant isolation: a ticket belonging to anyone else simply does not exist here.
  if (!ticket || ticket.user_id !== user.id) notFound();

  // `false` keeps staff-only notes out of the customer's view.
  const messages = await ticketMessages(id, false);
  const locale = await currentLocale();
  const t = dict(locale).dashboard.support;

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-7 sm:px-6 lg:py-10">
      <Link
        href="/dashboard/support"
        className="mb-3 inline-flex items-center gap-1.5 text-[12.5px] text-mist-400 transition hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" />
        {t.allTickets}
      </Link>

      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[24px] font-bold">{ticket.subject}</h1>
          <p className="mt-1 text-[12.5px] text-mist-500">
            {ticketCategoryLabel(ticket.category, locale)} ·{" "}
            {fill(t.openedAgo, { ago: timeAgo(ticket.created_at, locale) })}
          </p>
        </div>
        <Badge tone={ticket.status === "resolved" ? "neutral" : "warn"}>
          {ticketStatusLabel(ticket.status, locale)}
        </Badge>
      </header>

      <SectionCard title={t.conversation} className="mb-4">
        <ul className="space-y-3 p-5">
          {messages.map((message) => (
            <li
              key={message.id}
              className={`rounded-2xl border p-4 ${
                message.author_side === "staff"
                  ? "border-white/10 bg-white/[0.05]"
                  : "border-white/8 bg-white/[0.02]"
              }`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[12.5px] font-semibold">
                  {message.author_side === "staff" ? t.staffName : message.author_name}
                </span>
                {message.author_side === "staff" && (
                  <Badge tone="accent">
                    <Shield className="h-3 w-3" />
                    {t.staffBadge}
                  </Badge>
                )}
                <span className="ms-auto text-[11px] text-mist-600">
                  {formatDateTime(message.created_at, locale)}
                </span>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-[13.5px] leading-[1.9] text-mist-200">
                {message.body}
              </p>
            </li>
          ))}
        </ul>
      </SectionCard>

      <SectionCard title={t.yourReply}>
        <div className="p-5">
          <CustomerReplyForm
            ticketId={ticket.id}
            resolved={ticket.status === "resolved"}
            copy={t}
          />
        </div>
      </SectionCard>
    </main>
  );
}
