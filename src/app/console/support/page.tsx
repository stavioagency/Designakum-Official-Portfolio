import Link from "next/link";
import type { Metadata } from "next";
import { listTickets, ticketCounts } from "@/lib/support";
import { TICKET_CATEGORY_LABEL, TICKET_PRIORITY_LABEL, TICKET_STATUS_LABEL } from "@/lib/support-labels";
import { guardPage } from "@/lib/permissions";
import {
  Badge,
  EmptyState,
  PageHeader,
  Pagination,
  SectionCard,
  Tabs,
  timeAgo,
} from "@/components/console/ui";
import { SearchField } from "@/components/console/forms";
import { LifeBuoy } from "@/components/icons";
import type { TicketPriority, TicketStatus } from "@/lib/types";

export const metadata: Metadata = { title: "الدعم" };
export const dynamic = "force-dynamic";

const PER_PAGE = 20;

const PRIORITY_TONE: Record<TicketPriority, "bad" | "warn" | "neutral" | "accent"> = {
  urgent: "bad",
  high: "warn",
  normal: "neutral",
  low: "neutral",
};

const STATUS_TONE: Record<TicketStatus, "bad" | "warn" | "accent" | "neutral"> = {
  open: "bad",
  in_progress: "accent",
  waiting_customer: "warn",
  resolved: "neutral",
};

type Search = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function SupportQueuePage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  await guardPage("support.manage");
  const params = await searchParams;

  const status = (one(params.status) ?? "open_like") as TicketStatus | "all" | "open_like";
  const search = one(params.q) ?? "";
  const page = Math.max(1, Number(one(params.page)) || 1);

  const counts = await ticketCounts();
  const { rows, total } = await listTickets({
    status,
    search,
    limit: PER_PAGE,
    offset: (page - 1) * PER_PAGE,
  });

  const build = (next: { status?: string; page?: number }) => {
    const query = new URLSearchParams();
    const nextStatus = next.status ?? status;
    if (nextStatus !== "open_like") query.set("status", nextStatus);
    if (search) query.set("q", search);
    if ((next.page ?? 1) > 1) query.set("page", String(next.page));
    const qs = query.toString();
    return qs ? `/console/support?${qs}` : "/console/support";
  };

  return (
    <>
      <PageHeader title="تذاكر الدعم" description="طلبات العملاء الواردة من لوحاتهم." />

      <div className="mb-4 space-y-3">
        <Tabs
          current={status}
          build={(key) => build({ status: key })}
          tabs={[
            {
              key: "open_like",
              label: "قيد العمل",
              count: counts.open + counts.in_progress + counts.waiting_customer,
            },
            { key: "open", label: TICKET_STATUS_LABEL.open, count: counts.open },
            { key: "in_progress", label: TICKET_STATUS_LABEL.in_progress, count: counts.in_progress },
            {
              key: "waiting_customer",
              label: TICKET_STATUS_LABEL.waiting_customer,
              count: counts.waiting_customer,
            },
            { key: "resolved", label: TICKET_STATUS_LABEL.resolved, count: counts.resolved },
            { key: "all", label: "الكل", count: counts.all },
          ]}
        />
        <div className="card flex flex-wrap items-center gap-3 p-4">
          <SearchField placeholder="ابحث بعنوان التذكرة أو بريد العميل…" />
        </div>
      </div>

      <SectionCard>
        {rows.length === 0 ? (
          <EmptyState
            icon={<LifeBuoy className="h-5 w-5" />}
            title="لا تذاكر هنا"
            body="عندما يرسل عميل طلب دعم من لوحته ستجده في هذه القائمة."
          />
        ) : (
          <>
            <ul className="divide-y divide-white/6">
              {rows.map((ticket) => (
                <li key={ticket.id}>
                  <Link
                    href={`/console/support/${ticket.id}`}
                    className="flex flex-wrap items-center gap-3 px-4 py-3.5 transition hover:bg-white/[0.03] sm:px-5"
                  >
                    <Badge tone={STATUS_TONE[ticket.status]}>
                      {TICKET_STATUS_LABEL[ticket.status]}
                    </Badge>

                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-semibold">{ticket.subject}</span>
                      <span className="mt-0.5 flex items-center gap-2 text-[11.5px] text-mist-500">
                        <span dir="ltr">{ticket.customer_email}</span>
                        <span>· {TICKET_CATEGORY_LABEL[ticket.category] ?? ticket.category}</span>
                      </span>
                    </span>

                    <span className="flex shrink-0 items-center gap-2">
                      {ticket.priority !== "normal" && (
                        <Badge tone={PRIORITY_TONE[ticket.priority]}>
                          {TICKET_PRIORITY_LABEL[ticket.priority]}
                        </Badge>
                      )}
                      {ticket.assignee_email ? (
                        <Badge tone="accent">{ticket.assignee_email.split("@")[0]}</Badge>
                      ) : (
                        <Badge>غير مُسند</Badge>
                      )}
                      <span className="text-[11px] text-mist-600">{timeAgo(ticket.last_reply_at)}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
            <Pagination
              total={total}
              page={page}
              perPage={PER_PAGE}
              build={(next) => build({ page: next })}
            />
          </>
        )}
      </SectionCard>
    </>
  );
}
