import Link from "next/link";
import { logoutAction } from "@/app/actions/auth";
import { LogoLockup } from "@/components/brand/logo";
import { ExternalLink, Logout, Shield } from "@/components/icons";
import { can, ROLE_LABEL } from "@/lib/permissions";
import { ConsoleNav, type NavItem } from "./nav";
import type { User } from "@/lib/types";

export function ConsoleShell({
  user,
  counts,
  children,
}: {
  user: User;
  counts: { reports: number; tickets: number };
  children: React.ReactNode;
}) {
  // Nav is built from capabilities, so a support agent simply never sees the
  // sections they cannot open.
  const items: NavItem[] = [
    { href: "/console", label: "نظرة عامة", icon: "grid", permission: "console.access" },
    { href: "/console/customers", label: "العملاء", icon: "users", permission: "customers.view" },
    { href: "/console/moderation", label: "البلاغات", icon: "flag", permission: "moderation.review", badge: counts.reports },
    { href: "/console/support", label: "الدعم", icon: "lifebuoy", permission: "support.manage", badge: counts.tickets },
    { href: "/console/subscriptions", label: "الاشتراكات", icon: "card", permission: "billing.manage" },
    { href: "/console/invitations", label: "الدعوات", icon: "gift", permission: "invitations.manage" },
    { href: "/console/analytics", label: "التحليلات", icon: "chart", permission: "analytics.view" },
    { href: "/console/announcements", label: "الإعلانات", icon: "megaphone", permission: "announcements.manage" },
    { href: "/console/audit", label: "سجل التدقيق", icon: "history", permission: "audit.view" },
    { href: "/console/settings", label: "الإعدادات", icon: "sliders", permission: "settings.manage" },
  ]
    .filter((item) => can(user, item.permission as Parameters<typeof can>[1]))
    .map(({ permission, ...item }) => item as NavItem);

  return (
    <div className="relative z-10 min-h-dvh lg:grid lg:grid-cols-[260px_minmax(0,1fr)]">
      <aside className="sticky top-0 z-40 border-b border-white/8 bg-ink-950/80 backdrop-blur-xl lg:h-dvh lg:border-b-0 lg:border-s lg:border-white/8">
        <div className="flex h-16 items-center justify-between gap-3 px-4 lg:h-auto lg:px-5 lg:py-6">
          <LogoLockup href="/console" size={36} />
          <form action={logoutAction} className="lg:hidden">
            <button type="submit" aria-label="تسجيل الخروج" className="icon-btn !h-9 !w-9">
              <Logout className="h-[17px] w-[17px]" />
            </button>
          </form>
        </div>

        <div className="px-3 pb-3 lg:px-3">
          <ConsoleNav items={items} />
        </div>

        <div className="hidden px-3 lg:mt-auto lg:block">
          <Link
            href="/dashboard"
            className="flex items-center gap-2.5 rounded-2xl px-3.5 py-2.5 text-[13px] text-mist-500 transition hover:bg-white/[0.05] hover:text-white"
          >
            <ExternalLink className="h-[17px] w-[17px]" />
            لوحة العميل
          </Link>
        </div>

        <div className="hidden lg:absolute lg:inset-x-0 lg:bottom-0 lg:block lg:p-3">
          <div className="panel flex items-center gap-3 p-3">
            <span className="accent-grad grid h-9 w-9 shrink-0 place-items-center rounded-xl text-[13px] font-bold">
              {(user.display_name || user.email).trim().charAt(0).toUpperCase()}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[12.5px] font-semibold">
                {user.display_name || user.email}
              </span>
              <span className="flex items-center gap-1 text-[11px] text-mist-500">
                <Shield className="h-3 w-3" />
                {ROLE_LABEL[user.role]}
              </span>
            </span>
            <form action={logoutAction}>
              <button type="submit" aria-label="تسجيل الخروج" className="icon-btn !h-8 !w-8">
                <Logout className="h-4 w-4" />
              </button>
            </form>
          </div>
        </div>
      </aside>

      <main className="min-w-0 px-4 py-6 sm:px-6 lg:px-8 lg:py-9 lg:pb-28">{children}</main>
    </div>
  );
}
