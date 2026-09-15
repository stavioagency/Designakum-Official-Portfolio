import Link from "next/link";
import { logoutAction } from "@/app/actions/auth";
import { LogoLockup } from "./brand/logo";
import { LocaleSwitch } from "./locale-switch";
import { Logout, Shield } from "./icons";
import type { Locale, User } from "@/lib/types";

export function TopNav({
  user,
  links,
  locale,
  ownerLabel,
  logoutLabel,
}: {
  user: User;
  links: { href: string; label: string; external?: boolean }[];
  locale: Locale;
  ownerLabel: string;
  logoutLabel: string;
}) {
  return (
    <header className="sticky top-0 z-40 border-b border-white/8 bg-ink-950/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center gap-4 px-4 sm:px-6">
        <LogoLockup href={user.role === "client" ? "/dashboard" : "/console"} size={36} />

        <nav className="no-scrollbar flex flex-1 items-center gap-1 overflow-x-auto">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              target={link.external ? "_blank" : undefined}
              className="shrink-0 rounded-xl px-3 py-2 text-[13.5px] text-mist-400 transition hover:bg-white/[0.06] hover:text-white"
            >
              {link.label}
            </Link>
          ))}
        </nav>

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
    </header>
  );
}
