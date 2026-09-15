import Link from "next/link";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { getTicket, ticketMessages } from "@/lib/support";
import { TICKET_CATEGORY_LABEL, TICKET_STATUS_LABEL } from "@/lib/support-labels";
import { Badge, SectionCard, formatDateTime, timeAgo } from "@/components/console/ui";
import { CustomerReplyForm } from "@/components/support/customer-forms";
import { ArrowLeft, Shield } from "@/components/icons";

export const metadata: Metadata = { title: "تذكرة" };
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

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-7 sm:px-6 lg:py-10">
      <Link
        href="/dashboard/support"
        className="mb-3 inline-flex items-center gap-1.5 text-[12.5px] text-mist-400 transition hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" />
        كل التذاكر
      </Link>

      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[24px] font-bold">{ticket.subject}</h1>
          <p className="mt-1 text-[12.5px] text-mist-500">
            {TICKET_CATEGORY_LABEL[ticket.category] ?? ticket.category} · فُتحت {timeAgo(ticket.created_at)}
          </p>
        </div>
        <Badge tone={ticket.status === "resolved" ? "neutral" : "warn"}>
          {TICKET_STATUS_LABEL[ticket.status]}
        </Badge>
      </header>

      <SectionCard title="المحادثة" className="mb-4">
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
                  {message.author_side === "staff" ? "فريق ديزاينكم" : message.author_name}
                </span>
                {message.author_side === "staff" && (
                  <Badge tone="accent">
                    <Shield className="h-3 w-3" />
                    الدعم
                  </Badge>
                )}
                <span className="ms-auto text-[11px] text-mist-600">
                  {formatDateTime(message.created_at)}
                </span>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-[13.5px] leading-[1.9] text-mist-200">
                {message.body}
              </p>
            </li>
          ))}
        </ul>
      </SectionCard>

      <SectionCard title="ردك">
        <div className="p-5">
          <CustomerReplyForm ticketId={ticket.id} resolved={ticket.status === "resolved"} />
        </div>
      </SectionCard>
    </main>
  );
}
