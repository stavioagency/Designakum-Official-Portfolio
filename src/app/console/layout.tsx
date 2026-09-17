import type { Metadata } from "next";
import { openErrorCount } from "@/lib/error-log";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { reportCounts } from "@/lib/moderation";
import { openTicketCount } from "@/lib/support";
import { ConsoleShell } from "@/components/console/shell";
import { currentLocale } from "@/lib/locale";
import { dict } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  const nav = dict(await currentLocale()).console.nav;
  return {
    title: { default: nav.title, template: nav.titleTemplate },
    robots: { index: false, follow: false },
  };
}

export const dynamic = "force-dynamic";

export default async function ConsoleLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  if (!user) redirect("/login?next=/console");
  // Clients never learn the console exists: they land back on their own dashboard.
  if (!can(user, "console.access")) redirect("/dashboard");

  const locale = await currentLocale();
  const reports = can(user, "moderation.review") ? await reportCounts() : { pending: 0, reviewing: 0 };
  const tickets = can(user, "support.manage") ? await openTicketCount() : 0;

  return (
    <ConsoleShell
      user={user}
      counts={{ errors: await openErrorCount(), reports: reports.pending + reports.reviewing, tickets }}
      copy={dict(locale).console}
      locale={locale}
    >
      {children}
    </ConsoleShell>
  );
}
