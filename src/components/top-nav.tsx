import Link from "next/link";
import { NotificationHub } from "./notification-hub";
import { logoutAction } from "@/app/actions/auth";
import { LogoLockup } from "./brand/logo";
import { LocaleSwitch } from "./locale-switch";
import { Logout, Shield } from "./icons";
import type { Locale, User } from "@/lib/types";

type NavLink = { href: string; label: string; external?: boolean };

const linkClass =
  "shrink-0 rounded-xl px-3 py-2 text-[13.5px] text-mist-400 transition hover:bg-white/[0.06] hover:text-white";

function NavLinks({ links }: { links: NavLink[] }) {
  return links.map((link) => (
    <Link
      key={link.href}
      href={link.href}
      target={link.external ? "_blank" : undefined}
      className={linkClass}
    >
      {link.label}
    </Link>
  ));
}

export function TopNav({
  user,
  links,
  locale,
  ownerLabel,
  logoutLabel,
  notifications,
}: {
  user: User;
  links: NavLink[];
  locale: Locale;
  ownerLabel: string;
  logoutLabel: string;
  /** Absent for staff, who read announcements in the console instead. */
  notifications?: React.ComponentProps<typeof NotificationHub> | null;
}) {
  return (
    <header className="sticky top-0 z-40 border-b border-white/8 bg-ink-950/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center gap-4 px-4 sm:px-6">
        <LogoLockup href={user.role === "client" ? "/dashboard" : "/console"} size={36} />

        {/* Beside the logo only where there is room for it. On a phone these
            links used to run off the right edge of a scroller with its scrollbar
            hidden, so Subscription, Domain and Support were not merely awkward
            to reach — nothing on screen said they were there at all. */}
        <nav className="no-scrollbar hidden flex-1 items-center gap-1 overflow-x-auto sm:flex">
          <NavLinks links={links} />
        </nav>

        <span className="flex-1 sm:hidden" />

        {notifications && <NotificationHub {...notifications} />}

        {user.role === "owner" && (
          <span className="hidden items-center gap-1.5 rounded-full bg-white/[0.06] px-3 py-1.5 text-[11.5px] text-mist-300 sm:flex">
            <Shield className="h-3.5 w-3.5" />
            {ownerLabel}
          </span>
        )}

        <LocaleSwitch locale={locale} />

        <form action={logoutAction}>
          <button
            type="submit"
            title={logoutLabel}
            aria-label={logoutLabel}
            className="icon-btn !h-10 !w-10"
          >
            <Logout className="h-[18px] w-[18px]" />
          </button>
        </form>
      </div>

      {/* Wrapped rather than scrolled: six links fit in two rows on a phone, and
          two visible rows beat one row with half of it off-screen. */}
      <nav className="flex flex-wrap items-center gap-1 border-t border-white/8 px-2 pb-2 pt-1.5 sm:hidden">
        <NavLinks links={links} />
      </nav>
    </header>
  );
}
