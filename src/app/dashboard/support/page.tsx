import Link from "next/link";
import type { Metadata } from "next";
import { currentLocale } from "@/lib/locale";
import { dict, fill } from "@/lib/i18n";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { ticketsForUser } from "@/lib/support";
import { ticketCategories, ticketStatusLabel } from "@/lib/support-labels";
import { readSettings } from "@/lib/settings";
import { Badge, EmptyState, SectionCard, timeAgo } from "@/components/console/ui";
import { NewTicketForm } from "@/components/support/customer-forms";
import { LifeBuoy } from "@/components/icons";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: dict(await currentLocale()).meta.support,
  };
}
export const dynamic = "force-dynamic";

export default async function CustomerSupportPage() {
  const user = await currentUser();
  if (!user) redirect("/login");

  const settings = await readSettings();
  const tickets = await ticketsForUser(user.id);
  const locale = await currentLocale();
  const t = dict(locale).dashboard.support;

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-7 sm:px-6 lg:py-10">
      <header className="mb-6">
        <h1 className="text-[26px] font-bold">{t.title}</h1>
        <p className="mt-1 text-[13.5px] text-mist-400">
          {settings["support.hours"]}
        </p>
      </header>

      {settings["features.support"] ? (
        <SectionCard title={t.newTicket} className="mb-4">
          <div className="p-5">
            <NewTicketForm
              intro={settings["support.intro"]}
              copy={t}
              categories={ticketCategories(locale)}
            />
          </div>
        </SectionCard>
      ) : (
        <p className="panel mb-4 px-4 py-3 text-[13px] text-mist-400">
          {t.closed}{" "}
          <span dir="ltr">{settings["brand.support_email"]}</span>.
        </p>
      )}

      <SectionCard title={t.mine} description={fill(t.count, { n: tickets.length })}>
        {tickets.length === 0 ? (
          <EmptyState
            icon={<LifeBuoy className="h-5 w-5" />}
            title={t.emptyTitle}
            body={t.emptyBody}
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
                    {ticketStatusLabel(ticket.status, locale)}
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
