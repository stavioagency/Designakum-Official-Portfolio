import "server-only";
import { all, get, now, run } from "./db";
import { newId } from "./ids";
import { planDefinitions } from "./billing";

export type EventKind = "view" | "whatsapp" | "social" | "project";
export const EVENT_KINDS: EventKind[] = ["view", "whatsapp", "social", "project"];

/**
 * Analytics days are cut in the platform's own timezone, not UTC.
 *
 * With UTC, a Riyadh designer's "today" ended at 3am local and the evening — when
 * people actually share portfolio links — landed on the next day's row. Every
 * daily figure was skewed by three hours.
 */
export const REPORTING_TIMEZONE = process.env.REPORTING_TIMEZONE ?? "Asia/Riyadh";

const dayFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: REPORTING_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

// en-CA formats as YYYY-MM-DD, which is what the day columns store.
export const dayKey = (ms = now()) => dayFormatter.format(new Date(ms));

export async function recordPortfolioEvent(portfolioId: string, kind: EventKind, day = dayKey()) {
  await run(
    `INSERT INTO portfolio_events (id, portfolio_id, kind, day, count) VALUES (?, ?, ?, ?, 1)
     ON CONFLICT(portfolio_id, kind, day) DO UPDATE SET count = portfolio_events.count + 1`,
    newId("pev"),
    portfolioId,
    kind,
    day,
  );
}

/**
 * Marks a visitor as seen for the day. The hash is derived from request headers
 * and never stored alongside anything identifying, which is enough to count
 * unique visitors without building a profile of them.
 */
export async function markUniqueVisitor(portfolioId: string, visitorHash: string, day = dayKey()) {
  await run(
    `INSERT INTO visit_marks (portfolio_id, day, visitor_hash) VALUES (?, ?, ?)
     ON CONFLICT(portfolio_id, day, visitor_hash) DO NOTHING`,
    portfolioId,
    day,
    visitorHash,
  );
}

/* ------------------------------------------------------------------ series */

function lastDays(days: number): string[] {
  const out: string[] = [];
  const today = Date.now();
  for (let i = days - 1; i >= 0; i--) out.push(dayKey(today - i * 86_400_000));
  return out;
}

export interface Series {
  day: string;
  value: number;
}

function seriesFrom(rows: { day: string; value: number }[], days: number): Series[] {
  const map = new Map(rows.map((r) => [r.day, r.value]));
  return lastDays(days).map((day) => ({ day, value: map.get(day) ?? 0 }));
}

export async function eventSeries(kind: EventKind, days = 30, portfolioId?: string): Promise<Series[]>{
  const rows = await all<{ day: string; value: number }>(
    `SELECT day, SUM(count)::int AS value FROM portfolio_events
      WHERE kind = ? ${portfolioId ? "AND portfolio_id = ?" : ""} AND day >= ?
      GROUP BY day`,
    ...(portfolioId ? [kind, portfolioId] : [kind]),
    lastDays(days)[0],
  );
  return seriesFrom(rows, days);
}

export async function uniqueVisitorSeries(days = 30): Promise<Series[]>{
  const rows = await all<{ day: string; value: number }>(
    "SELECT day, COUNT(*)::int AS value FROM visit_marks WHERE day >= ? GROUP BY day",
    lastDays(days)[0],
  );
  return seriesFrom(rows, days);
}

export async function registrationSeries(days = 30): Promise<Series[]>{
  const since = Date.now() - days * 86_400_000;
  const rows = await all<{ day: string; value: number }>(
    `SELECT to_char(to_timestamp(created_at / 1000.0) AT TIME ZONE ?::text, 'YYYY-MM-DD') AS day, COUNT(*)::int AS value
       FROM users WHERE role = 'client' AND created_at >= ? GROUP BY day`,
    REPORTING_TIMEZONE,
    since,
  );
  return seriesFrom(rows, days);
}

export async function subscriptionSeries(days = 30): Promise<Series[]>{
  const since = Date.now() - days * 86_400_000;
  const rows = await all<{ day: string; value: number }>(
    `SELECT to_char(to_timestamp(created_at / 1000.0) AT TIME ZONE ?::text, 'YYYY-MM-DD') AS day, COUNT(*)::int AS value
       FROM subscriptions WHERE created_at >= ? GROUP BY day`,
    REPORTING_TIMEZONE,
    since,
  );
  return seriesFrom(rows, days);
}

export const seriesTotal = (series: Series[]) => series.reduce((sum, p) => sum + p.value, 0);

/* ------------------------------------------------------------------ totals */

export async function eventTotal(kind: EventKind, days?: number, portfolioId?: string): Promise<number>{
  const params: unknown[] = [kind];
  let clause = "WHERE kind = ?";
  if (portfolioId) {
    clause += " AND portfolio_id = ?";
    params.push(portfolioId);
  }
  if (days) {
    clause += " AND day >= ?";
    params.push(lastDays(days)[0]);
  }
  const row = await get<{ n: number }>(
    `SELECT COALESCE(SUM(count), 0) AS n FROM portfolio_events ${clause}`,
    ...params,
  );
  return row?.n ?? 0;
}

export async function uniqueVisitorTotal(days?: number): Promise<number>{
  return days
    ? (await get<{ n: number }>(
        "SELECT COUNT(*) AS n FROM visit_marks WHERE day >= ?",
        lastDays(days)[0],
      ))?.n ?? 0
    : (await get<{ n: number }>("SELECT COUNT(*) AS n FROM visit_marks"))?.n ?? 0;
}

export interface TopPortfolio {
  id: string;
  name: string;
  slug: string;
  views: number;
  suspended: number;
  owner_email: string;
}

export async function topPortfolios(limit = 8, days?: number) {
  if (!days) {
    return await all<TopPortfolio>(
      `SELECT p.id, p.name, p.slug, p.views, p.suspended, u.email AS owner_email
         FROM portfolios p JOIN users u ON u.id = p.user_id
        ORDER BY p.views DESC LIMIT ?`,
      limit,
    );
  }
  return await all<TopPortfolio>(
    `SELECT p.id, p.name, p.slug, p.suspended, u.email AS owner_email,
            COALESCE(SUM(e.count), 0) AS views
       FROM portfolios p
       JOIN users u ON u.id = p.user_id
       LEFT JOIN portfolio_events e
         ON e.portfolio_id = p.id AND e.kind = 'view' AND e.day >= ?
      GROUP BY p.id
      ORDER BY views DESC LIMIT ?`,
    lastDays(days)[0],
    limit,
  );
}

/* ----------------------------------------------------------------- revenue */

export interface RevenueSnapshot {
  mrr: number;
  arr: number;
  monthlyCount: number;
  yearlyCount: number;
  compedCount: number;
  paidCount: number;
}

/**
 * Only subscriptions that actually billed money count toward revenue: comped and
 * invited accounts are real subscriptions but contribute 0, and a yearly plan is
 * spread across twelve months for MRR.
 */
export async function revenueSnapshot(): Promise<RevenueSnapshot>{
  const rows = await all<{ plan: string; source: string; amount: number; n: number }>(
    `SELECT s.plan, s.source, s.amount, COUNT(*) AS n
       FROM subscriptions s
      WHERE s.status = 'active'
        AND (s.current_period_end IS NULL OR s.current_period_end > ?)
        AND s.id = (SELECT s2.id FROM subscriptions s2 WHERE s2.user_id = s.user_id
                     ORDER BY s2.created_at DESC, s2.seq DESC LIMIT 1)
      GROUP BY s.plan, s.source, s.amount`,
    now(),
  );

  const plans = await planDefinitions();
  let mrr = 0;
  let monthlyCount = 0;
  let yearlyCount = 0;
  let compedCount = 0;
  let paidCount = 0;

  for (const row of rows) {
    if (row.plan === "monthly") monthlyCount += row.n;
    if (row.plan === "yearly") yearlyCount += row.n;

    if (row.source === "paid") {
      paidCount += row.n;
      const amount = row.amount || plans[row.plan as "monthly" | "yearly"].amount;
      mrr += row.plan === "yearly" ? (amount / 12) * row.n : amount * row.n;
    } else {
      compedCount += row.n;
    }
  }

  return { mrr, arr: mrr * 12, monthlyCount, yearlyCount, compedCount, paidCount };
}

/** Cancellations and expiries in the window, over what was live going into it. */
export async function churnRate(
  days = 30,
): Promise<{ lost: number; base: number; percent: number }> {
  const since = Date.now() - days * 86_400_000;
  const lost =
    (await get<{ n: number }>(
      `SELECT COUNT(*) AS n FROM subscriptions
        WHERE status IN ('canceled','expired') AND updated_at >= ?`,
      since,
    ))?.n ?? 0;

  const activeNow =
    (await get<{ n: number }>(
      `SELECT COUNT(DISTINCT user_id) AS n FROM subscriptions
        WHERE status = 'active' AND (current_period_end IS NULL OR current_period_end > ?)`,
      now(),
    ))?.n ?? 0;

  const base = activeNow + lost;
  return { lost, base, percent: base > 0 ? (lost / base) * 100 : 0 };
}

/** Share of client accounts that have ever held a subscription. */
export async function conversionRate(): Promise<{
  converted: number;
  total: number;
  percent: number;
}> {
  const total = (await get<{ n: number }>("SELECT COUNT(*) AS n FROM users WHERE role = 'client'"))?.n ?? 0;
  const converted =
    (await get<{ n: number }>(
      "SELECT COUNT(DISTINCT user_id) AS n FROM subscriptions",
    ))?.n ?? 0;
  return { converted, total, percent: total > 0 ? (converted / total) * 100 : 0 };
}
