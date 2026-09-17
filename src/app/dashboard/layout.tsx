import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { needsOnboarding } from "@/lib/onboarding";
import { getPortfolioForUser } from "@/lib/portfolios";
import { TopNav } from "@/components/top-nav";
import { announcementHistoryFor } from "@/lib/announcements";
import { currentLocale } from "@/lib/locale";
import { dict } from "@/lib/i18n";
import { maintenanceState } from "@/lib/maintenance";
import { MaintenanceNotice } from "@/components/maintenance-notice";

// A signed-in surface has nothing to offer a search engine, and robots.txt is
// only a request — this is the header that actually keeps it out of an index.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const maintenance = await maintenanceState();
  if (maintenance.blocked) {
    return <MaintenanceNotice message={maintenance.message} staff={maintenance.staff} />;
  }

  const user = await currentUser();
  if (!user) redirect("/login");
  if (needsOnboarding(user)) redirect("/welcome");

  const locale = await currentLocale();
  const nav = dict(locale).dashboard.nav;
  const portfolio = await getPortfolioForUser(user.id);
  if (!portfolio) redirect(user.role === "client" ? "/login" : "/console");

  // Platform chrome always wears Designakum blue; a portfolio's own accent applies
  // inside the preview, which carries its own data-theme.
  return (
    <div className="relative z-10 min-h-dvh">
      <TopNav
        user={user}
        locale={locale}
        ownerLabel={nav.owner}
        logoutLabel={nav.logout}
        notifications={{
          items: await announcementHistoryFor(user.id),
          locale,
          copy: {
            title: dict(locale).announcements.hubTitle,
            empty: dict(locale).announcements.hubEmpty,
            seen: dict(locale).announcements.hubSeen,
            open: dict(locale).announcements.hubOpen,
            dismiss: dict(locale).announcements.dismiss,
          },
        }}
        links={[
          { href: "/dashboard", label: nav.editor },
          { href: "/dashboard/preview", label: nav.preview },
          { href: "/dashboard/billing", label: nav.billing },
          { href: "/dashboard/domain", label: nav.domain },
          { href: "/dashboard/support", label: nav.support },
          { href: `/p/${portfolio.slug}`, label: nav.publicPage, external: true },
          ...(user.role === "owner" || user.role === "support"
            ? [{ href: "/console", label: nav.console }]
            : []),
        ]}
      />
      {children}
    </div>
  );
}
