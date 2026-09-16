import Link from "next/link";
import { logoutAction } from "@/app/actions/auth";
import { LogoLockup } from "@/components/brand/logo";
import { ExternalLink, Logout, Shield } from "@/components/icons";
import { can, roleLabel } from "@/lib/permissions";
import { ConsoleNav, type NavItem } from "./nav";
import { MobileDrawer } from "./mobile-drawer";
import { LocaleSwitch } from "@/components/locale-switch";
import type { Dictionary } from "@/lib/i18n";
import type { Locale, User } from "@/lib/types";

export function ConsoleShell({
  user,
  counts,
  children,
  copy,
  locale,
}: {
  user: User;
  counts: { reports: number; tickets: number };
  children: React.ReactNode;
  copy: Dictionary["console"];
  locale: Locale;
}) {
  const nav = copy.nav;
  // Nav is built from capabilities, so a support agent simply never sees the
  // sections they cannot open.
  const items: NavItem[] = [
    { href: "/console", label: nav.overview, icon: "grid", permission: "console.access" },
    { href: "/console/customers", label: nav.customers, icon: "users", permission: "customers.view" },
    { href: "/console/moderation", label: nav.moderation, icon: "flag", permission: "moderation.review", badge: counts.reports },
    { href: "/console/support", label: nav.support, icon: "lifebuoy", permission: "support.manage", badge: counts.tickets },
    { href: "/console/subscriptions", label: nav.subscriptions, icon: "card", permission: "billing.manage" },
    { href: "/console/invitations", label: nav.invitations, icon: "gift", permission: "invitations.manage" },
    { href: "/console/analytics", label: nav.analytics, icon: "chart", permission: "analytics.view" },
    { href: "/console/announcements", label: nav.announcements, icon: "megaphone", permission: "announcements.manage" },
    { href: "/console/audit", label: nav.audit, icon: "history", permission: "audit.view" },
    { href: "/console/settings", label: nav.settings, icon: "sliders", permission: "settings.manage" },
  ]
    .filter((item) => can(user, item.permission as Parameters<typeof can>[1]))
    .map(({ permission, ...item }) => item as NavItem);

  return (
    <div className="relative z-10 min-h-dvh lg:grid lg:grid-cols-[260px_minmax(0,1fr)]">
      <aside className="sticky top-0 z-40 border-b border-white/8 bg-ink-950/80 backdrop-blur-xl lg:h-dvh lg:border-b-0 lg:border-s lg:border-white/8">
        <div className="flex h-16 items-center justify-between gap-2 px-4 lg:h-auto lg:px-5 lg:py-6">
          <LogoLockup href="/console" size={36} />

          <div className="flex items-center gap-2 lg:hidden">
            <LocaleSwitch locale={locale} />
            <form action={logoutAction}>
              <button type="submit" aria-label={nav.logout} className="icon-btn !h-10 !w-10">
                <Logout className="h-[17px] w-[17px]" />
              </button>
            </form>
            {/* Ten sections wrapped into three rows and ate the top third of
                every screen before any content appeared. */}
            <MobileDrawer label={nav.menu} closeLabel={nav.closeMenu}>
              <ConsoleNav items={items} vertical />
              <Link
                href="/dashboard"
                className="mt-2 flex items-center gap-2.5 rounded-2xl px-3.5 py-2.5 text-[13px] text-mist-400 transition hover:bg-white/[0.05] hover:text-white"
              >
                <ExternalLink className="h-[17px] w-[17px]" />
                {nav.clientDashboard}
              </Link>
            </MobileDrawer>
          </div>
        </div>

        <div className="hidden px-3 pb-3 lg:block lg:px-3">
          <ConsoleNav items={items} />
        </div>

        <div className="hidden px-3 lg:mt-auto lg:block">
          <Link
            href="/dashboard"
            className="flex items-center gap-2.5 rounded-2xl px-3.5 py-2.5 text-[13px] text-mist-500 transition hover:bg-white/[0.05] hover:text-white"
          >
            <ExternalLink className="h-[17px] w-[17px]" />
            {nav.clientDashboard}
          </Link>

          {/* Staff need the switch too — a support agent answering an English
              customer should be able to read the console in the same language. */}
          <div className="mt-2 px-1">
            <LocaleSwitch locale={locale} />
          </div>
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
                {roleLabel(user.role, locale)}
              </span>
            </span>
            <form action={logoutAction}>
              <button type="submit" aria-label={nav.logout} className="icon-btn !h-8 !w-8">
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
