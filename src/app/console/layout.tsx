import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { reportCounts } from "@/lib/moderation";
import { openTicketCount } from "@/lib/support";
import { ConsoleShell } from "@/components/console/shell";

export const metadata: Metadata = {
  title: { default: "لوحة الإدارة", template: "%s · لوحة إدارة ديزاينكم" },
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function ConsoleLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  if (!user) redirect("/login?next=/console");
  // Clients never learn the console exists: they land back on their own dashboard.
  if (!can(user, "console.access")) redirect("/dashboard");

  const reports = can(user, "moderation.review") ? await reportCounts() : { pending: 0, reviewing: 0 };
  const tickets = can(user, "support.manage") ? await openTicketCount() : 0;

  return (
    <ConsoleShell
      user={user}
      counts={{ reports: reports.pending + reports.reviewing, tickets }}
    >
      {children}
    </ConsoleShell>
  );
}
