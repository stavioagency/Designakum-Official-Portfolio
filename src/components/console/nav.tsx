"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart,
  CreditCard,
  Flag,
  Gift,
  Grid,
  History,
  LifeBuoy,
  Megaphone,
  Sliders,
  Users,
} from "@/components/icons";

const ICONS = {
  grid: Grid,
  users: Users,
  flag: Flag,
  lifebuoy: LifeBuoy,
  card: CreditCard,
  gift: Gift,
  chart: BarChart,
  megaphone: Megaphone,
  history: History,
  sliders: Sliders,
} as const;

export type NavIcon = keyof typeof ICONS;

export interface NavItem {
  href: string;
  label: string;
  icon: NavIcon;
  badge?: number;
}

export function ConsoleNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-wrap gap-1.5 lg:flex-col lg:flex-nowrap lg:gap-1">
      {items.map((item) => {
        const Icon = ICONS[item.icon];
        // The dashboard root would otherwise match every nested console route.
        const active =
          item.href === "/console"
            ? pathname === "/console"
            : pathname === item.href || pathname.startsWith(`${item.href}/`);

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`flex shrink-0 items-center gap-2.5 rounded-2xl px-3.5 py-2.5 text-[13.5px] font-medium transition ${
              active
                ? "bg-white/[0.09] text-white shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08)]"
                : "text-mist-400 hover:bg-white/[0.05] hover:text-white"
            }`}
          >
            <Icon
              className="h-[18px] w-[18px] shrink-0"
              style={active ? { color: "var(--accent-ring)" } : undefined}
            />
            <span className="whitespace-nowrap">{item.label}</span>
            {item.badge !== undefined && item.badge > 0 && (
              <span className="tnum ms-auto rounded-full bg-rose-500/20 px-1.5 py-0.5 text-[10.5px] font-bold text-rose-200">
                {item.badge > 99 ? "99+" : item.badge}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
