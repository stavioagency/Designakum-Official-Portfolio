import Link from "next/link";
import type { Series } from "@/lib/analytics";
import type { Locale } from "@/lib/types";

/* ------------------------------------------------------------------ format */

export const nf = new Intl.NumberFormat("en-US");

/**
 * Always Riyadh, never the server's clock.
 *
 * Vercel runs in UTC, so an unpinned formatter would have shown a Riyadh evening
 * as the previous day — the same three-hour skew that was wrong in the analytics
 * buckets, just in the rendering instead of the query.
 */
const DISPLAY_TIMEZONE = process.env.REPORTING_TIMEZONE ?? "Asia/Riyadh";

/**
 * Latin digits in both languages. Arabic-Indic numerals are correct Arabic but
 * this platform shows prices, view counts and dates side by side, and mixing the
 * two numeral systems on one screen reads as a bug.
 */
const DATE_LOCALE: Record<Locale, string> = {
  ar: "ar-SA-u-nu-latn-ca-gregory",
  en: "en-GB",
};

export function formatDate(
  ms: number | null | undefined,
  locale: Locale = "ar",
  withTime = false,
): string {
  if (!ms) return "—";
  return new Date(ms).toLocaleDateString(DATE_LOCALE[locale] ?? DATE_LOCALE.ar, {
    timeZone: DISPLAY_TIMEZONE,
    year: "numeric",
    month: "short",
    day: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  });
}

/**
 * For anything where "which day" is not enough: money moving, a staff action, a
 * message in a thread. Support and billing arguments are settled on the minute.
 */
export const formatDateTime = (ms: number | null | undefined, locale: Locale = "ar") =>
  formatDate(ms, locale, true);

const UNITS: [limit: number, divisor: number, ar: string, en: string][] = [
  [60_000, 1000, "ثانية", "s"],
  [3_600_000, 60_000, "دقيقة", "min"],
  [86_400_000, 3_600_000, "ساعة", "h"],
  [2_592_000_000, 86_400_000, "يوم", "d"],
];

export function timeAgo(ms: number | null | undefined, locale: Locale = "ar"): string {
  if (!ms) return "—";
  const diff = Date.now() - ms;
  if (diff < 45_000) return locale === "en" ? "just now" : "الآن";

  for (const [limit, divisor, ar, en] of UNITS) {
    if (diff >= limit) continue;
    const n = Math.round(diff / divisor);
    return locale === "en" ? `${n}${en} ago` : `قبل ${n} ${ar}`;
  }
  return formatDate(ms, locale);
}

/** Halalas → a plain riyal figure; the symbol is rendered separately. */
export const money = (halalas: number) =>
  (halalas / 100).toLocaleString("en-US", { maximumFractionDigits: 2 });

/* ------------------------------------------------------------------ pieces */

type Tone = "neutral" | "good" | "warn" | "bad" | "accent";

const TONE_CLASS: Record<Tone, string> = {
  neutral: "bg-white/[0.07] text-mist-300",
  good: "bg-emerald-400/12 text-emerald-300",
  warn: "bg-amber-400/12 text-amber-300",
  bad: "bg-rose-500/12 text-rose-300",
  accent: "bg-[color-mix(in_oklab,var(--accent-from)_20%,transparent)] text-[var(--accent-ring)]",
};

export function Badge({
  children,
  tone = "neutral",
  className = "",
}: {
  children: React.ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-semibold ${TONE_CLASS[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

export function StatCard({
  label,
  value,
  hint,
  tone = "neutral",
  icon,
  href,
  series,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: Tone;
  icon?: React.ReactNode;
  href?: string;
  series?: Series[];
}) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="text-[12.5px] text-mist-400">{label}</p>
        {icon && (
          <span className={`grid h-8 w-8 place-items-center rounded-xl ${TONE_CLASS[tone]}`}>
            {icon}
          </span>
        )}
      </div>
      <p className="tnum mt-2.5 text-[27px] font-bold leading-none">{value}</p>
      {hint && <p className="mt-2 text-[11.5px] text-mist-500">{hint}</p>}
      {series && series.length > 1 && (
        <div className="mt-3">
          <Sparkline series={series} />
        </div>
      )}
    </>
  );

  const className = `card block p-5 ${href ? "lift" : ""}`;
  return href ? (
    <Link href={href} className={className}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}

/** Compact trend line; drawn LTR because time reads left-to-right in charts. */
export function Sparkline({ series, height = 34 }: { series: Series[]; height?: number }) {
  const values = series.map((p) => p.value);
  const max = Math.max(1, ...values);
  const step = 100 / Math.max(1, series.length - 1);

  // Time reads left-to-right in a chart even on an RTL page, so the newest point
  // sits on the right regardless of direction.
  const points = values.map((v, i) => `${i * step},${30 - (v / max) * 28}`).join(" ");

  return (
    <svg
      viewBox="0 0 100 32"
      preserveAspectRatio="none"
      style={{ height }}
      className="w-full"
      aria-hidden
    >
      <polyline
        points={`0,32 ${points} 100,32`}
        fill="color-mix(in oklab, var(--accent-from) 18%, transparent)"
        stroke="none"
      />
      <polyline
        points={points}
        fill="none"
        stroke="var(--accent-ring)"
        strokeWidth="1.6"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

export function BarSeries({ series, height = 120 }: { series: Series[]; height?: number }) {
  const max = Math.max(1, ...series.map((p) => p.value));

  return (
    <div className="flex items-end gap-[3px]" style={{ height }} dir="ltr">
      {series.map((point) => (
        <div key={point.day} className="group relative flex-1">
          <div
            className="accent-grad w-full rounded-t-[3px] transition-opacity group-hover:opacity-80"
            style={{ height: Math.max(2, (point.value / max) * height) }}
          />
          <span className="glass pointer-events-none absolute bottom-full left-1/2 z-10 mb-1.5 hidden -translate-x-1/2 whitespace-nowrap rounded-lg px-2 py-1 text-[10.5px] group-hover:block">
            {point.day} · {point.value}
          </span>
        </div>
      ))}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-[26px] font-bold">{title}</h1>
        {description && <p className="mt-1 text-[13.5px] text-mist-400">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function SectionCard({
  title,
  description,
  actions,
  children,
  className = "",
}: {
  title?: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`card overflow-hidden ${className}`}>
      {title && (
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/8 px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-[15px] font-semibold">{title}</h2>
            {description && <p className="mt-0.5 text-[12px] text-mist-500">{description}</p>}
          </div>
          {actions}
        </header>
      )}
      {children}
    </section>
  );
}

export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  body?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="grid place-items-center px-6 py-14 text-center">
      {icon && (
        <span className="mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-white/[0.05] text-mist-500">
          {icon}
        </span>
      )}
      <p className="text-[15px] font-semibold">{title}</p>
      {body && <p className="mx-auto mt-2 max-w-sm text-[13px] leading-relaxed text-mist-500">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Tabs({
  tabs,
  current,
  build,
}: {
  tabs: { key: string; label: string; count?: number }[];
  current: string;
  build: (key: string) => string;
}) {
  return (
    <nav className="-mx-1 flex flex-wrap gap-2 px-1 pb-1">
      {tabs.map((tab) => {
        const active = tab.key === current;
        return (
          <Link
            key={tab.key}
            href={build(tab.key)}
            className={`flex shrink-0 items-center gap-2 rounded-2xl border px-4 py-2.5 text-[13.5px] font-medium transition ${
              active
                ? "accent-grad border-transparent text-white shadow-lg"
                : "border-white/10 bg-white/[0.03] text-mist-400 hover:bg-white/[0.07] hover:text-white"
            }`}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span
                className={`tnum rounded-full px-1.5 py-0.5 text-[11px] ${
                  active ? "bg-black/25" : "bg-white/[0.08]"
                }`}
              >
                {tab.count}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

export function Pagination({
  total,
  page,
  perPage,
  build,
  labels = { prev: "السابق", next: "التالي", range: "{from}–{to} من {total}" },
}: {
  total: number;
  page: number;
  perPage: number;
  build: (page: number) => string;
  labels?: { prev: string; next: string; range: string };
}) {
  const pages = Math.max(1, Math.ceil(total / perPage));
  if (pages <= 1) return null;

  const from = (page - 1) * perPage + 1;
  const to = Math.min(total, page * perPage);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/8 px-5 py-3.5">
      <p className="tnum text-[12px] text-mist-500">
        {labels.range
          .replace("{from}", String(from))
          .replace("{to}", String(to))
          .replace("{total}", String(total))}
      </p>
      <div className="flex items-center gap-2">
        <PageLink href={build(page - 1)} disabled={page <= 1}>
          {labels.prev}
        </PageLink>
        <span className="tnum text-[12px] text-mist-400">
          {page} / {pages}
        </span>
        <PageLink href={build(page + 1)} disabled={page >= pages}>
          {labels.next}
        </PageLink>
      </div>
    </div>
  );
}

function PageLink({
  href,
  disabled,
  children,
}: {
  href: string;
  disabled: boolean;
  children: React.ReactNode;
}) {
  const className = "rounded-xl border border-white/10 px-3 py-1.5 text-[12.5px] transition";
  return disabled ? (
    <span className={`${className} cursor-not-allowed text-mist-600 opacity-40`}>{children}</span>
  ) : (
    <Link href={href} className={`${className} text-mist-300 hover:bg-white/[0.07] hover:text-white`}>
      {children}
    </Link>
  );
}

export function KeyValue({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="panel px-3.5 py-3">
      <dt className="text-[11.5px] text-mist-500">{label}</dt>
      <dd className="mt-1 truncate text-[13.5px] text-mist-200">{children}</dd>
    </div>
  );
}
