import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { getPortfolioForUser } from "@/lib/portfolios";
import { TopNav } from "@/components/top-nav";
import { currentLocale } from "@/lib/locale";
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

  const locale = await currentLocale();
  const portfolio = await getPortfolioForUser(user.id);
  if (!portfolio) redirect(user.role === "client" ? "/login" : "/console");

  // Platform chrome always wears Designakum blue; a portfolio's own accent applies
  // inside the preview, which carries its own data-theme.
  return (
    <div className="relative z-10 min-h-dvh">
      <TopNav
        user={user}
        locale={locale}
        links={[
          { href: "/dashboard", label: "المحرر" },
          { href: "/dashboard/preview", label: "المعاينة" },
          { href: "/dashboard/billing", label: "الاشتراك" },
          { href: "/dashboard/support", label: "الدعم" },
          { href: `/p/${portfolio.slug}`, label: "الصفحة العامة", external: true },
          ...(user.role === "owner" || user.role === "support"
            ? [{ href: "/console", label: "لوحة الإدارة" }]
            : []),
        ]}
      />
      {children}
    </div>
  );
}
