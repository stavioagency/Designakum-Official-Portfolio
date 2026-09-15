import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { ticketsForUser } from "@/lib/support";
import { TICKET_STATUS_LABEL } from "@/lib/support-labels";
import { readSettings } from "@/lib/settings";
import { Badge, EmptyState, SectionCard, timeAgo } from "@/components/console/ui";
import { NewTicketForm } from "@/components/support/customer-forms";
import { LifeBuoy } from "@/components/icons";

export const metadata: Metadata = { title: "الدعم" };
export const dynamic = "force-dynamic";

export default async function CustomerSupportPage() {
  const user = await currentUser();
  if (!user) redirect("/login");

  const settings = readSettings();
  const tickets = ticketsForUser(user.id);

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-7 sm:px-6 lg:py-10">
      <header className="mb-6">
        <h1 className="text-[26px] font-bold">الدعم الفني</h1>
        <p className="mt-1 text-[13.5px] text-mist-400">
          {settings["support.hours"]}
        </p>
      </header>

      {settings["features.support"] ? (
        <SectionCard title="تذكرة جديدة" className="mb-4">
          <div className="p-5">
            <NewTicketForm intro={settings["support.intro"]} />
          </div>
        </SectionCard>
      ) : (
        <p className="panel mb-4 px-4 py-3 text-[13px] text-mist-400">
          استقبال التذاكر متوقف مؤقتًا. راسلنا على{" "}
          <span dir="ltr">{settings["brand.support_email"]}</span>.
        </p>
      )}

      <SectionCard title="تذاكري" description={`${tickets.length} تذكرة`}>
        {tickets.length === 0 ? (
          <EmptyState
            icon={<LifeBuoy className="h-5 w-5" />}
            title="لا تذاكر بعد"
            body="إذا واجهتك أي مشكلة، أرسل تذكرة من الأعلى وسنتابعها معك."
          />
        ) : (
          <ul className="divide-y divide-white/6">
            {tickets.map((ticket) => (
              <li key={ticket.id}>
                <Link
                  href={`/dashboard/support/${ticket.id}`}
                  className="flex flex-wrap items-center gap-3 px-5 py-3.5 transition hover:bg-white/[0.03]"
                >
                  <Badge tone={ticket.status === "resolved" ? "neutral" : "warn"}>
                    {TICKET_STATUS_LABEL[ticket.status]}
                  </Badge>
                  <span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold">
                    {ticket.subject}
                  </span>
                  <span className="text-[11px] text-mist-600">{timeAgo(ticket.last_reply_at)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </main>
  );
}
