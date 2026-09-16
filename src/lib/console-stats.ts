import "server-only";
import { all, get, now } from "./db";
import { churnRate, revenueSnapshot } from "./analytics";
import { openTicketCount } from "./support";
import { reportCounts } from "./moderation";

const DAY = 86_400_000;
const count = async (sql: string, ...params: unknown[]) =>
  (await get<{ n: number }>(sql, ...params))?.n ?? 0;

export interface PlatformStats {
  totalUsers: number;
  activeUsers: number;
  newThisWeek: number;
  newThisMonth: number;
  activeSubscriptions: number;
  monthlySubscribers: number;
  yearlySubscribers: number;
  compedSubscribers: number;
  freeUsers: number;
  suspendedUsers: number;
  suspendedPortfolios: number;
  endedSubscriptions: number;
  mrr: number;
  arr: number;
  churnPercent: number;
  openTickets: number;
  pendingReports: number;
  publishedPortfolios: number;
  totalPortfolios: number;
}

/**
 * Every figure on the console overview, gathered concurrently.
 *
 * These were awaited one after another, so the page cost fourteen sequential
 * round trips. None of them depends on another's result, and with the database
 * in one region and the app in another that ordering was the whole page load.
 * Issued together, the page waits for the slowest rather than the sum.
 */
export async function platformStats(): Promise<PlatformStats>{
  const ts = now();

  const [
    revenue,
    reports,
    totalUsers,
    activeSubscriptions,
    activeUsers,
    newThisWeek,
    newThisMonth,
    suspendedUsers,
    suspendedPortfolios,
    endedSubscriptions,
    churn,
    openTickets,
    publishedPortfolios,
    totalPortfolios,
  ] = await Promise.all([
    revenueSnapshot(),
    reportCounts(),
    count("SELECT COUNT(*) AS n FROM users WHERE role = 'client'"),
    count(
      `SELECT COUNT(DISTINCT user_id) AS n FROM subscriptions
        WHERE status = 'active' AND (current_period_end IS NULL OR current_period_end > ?)`,
      ts,
    ),
    // "Active" means seen in the last 30 days, which is what a session touch records.
    count("SELECT COUNT(*) AS n FROM users WHERE role = 'client' AND last_seen_at >= ?", ts - 30 * DAY),
    count("SELECT COUNT(*) AS n FROM users WHERE role = 'client' AND created_at >= ?", ts - 7 * DAY),
    count("SELECT COUNT(*) AS n FROM users WHERE role = 'client' AND created_at >= ?", ts - 30 * DAY),
    count("SELECT COUNT(*) AS n FROM users WHERE status = 'suspended'"),
    count("SELECT COUNT(*) AS n FROM portfolios WHERE suspended = 1"),
    count("SELECT COUNT(*) AS n FROM subscriptions WHERE status IN ('canceled','expired')"),
    churnRate(30),
    openTicketCount(),
    count("SELECT COUNT(*) AS n FROM portfolios WHERE published = 1"),
    count("SELECT COUNT(*) AS n FROM portfolios"),
  ]);

  return {
    totalUsers,
    activeUsers,
    newThisWeek,
    newThisMonth,
    activeSubscriptions,
    monthlySubscribers: revenue.monthlyCount,
    yearlySubscribers: revenue.yearlyCount,
    compedSubscribers: revenue.compedCount,
    freeUsers: Math.max(0, totalUsers - activeSubscriptions),
    suspendedUsers,
    suspendedPortfolios,
    endedSubscriptions,
    mrr: revenue.mrr,
    arr: revenue.arr,
    churnPercent: churn.percent,
    openTickets,
    pendingReports: reports.pending + reports.reviewing,
    publishedPortfolios,
    totalPortfolios,
  };
}

export type ActivityKind = "signup" | "subscription" | "report" | "ticket" | "audit";

export interface ActivityItem {
  id: string;
  kind: ActivityKind;
  title: string;
  detail: string;
  href: string | null;
  created_at: number;
}

/**
 * One merged stream of what has happened on the platform, assembled from the
 * tables that already record it rather than a separate activity log to keep in sync.
 */
export async function recentActivity(limit = 14): Promise<ActivityItem[]>{
  const signups = await all<ActivityItem>(
    `SELECT u.id AS id, 'signup' AS kind, u.display_name AS title, u.email AS detail,
            '/console/customers/' || u.id AS href, u.created_at AS created_at
       FROM users u WHERE u.role = 'client' ORDER BY u.created_at DESC LIMIT ?`,
    limit,
  );

  const subscriptions = await all<ActivityItem>(
    `SELECT s.id AS id, 'subscription' AS kind,
            s.plan AS title,
            u.email || ' · ' || s.source AS detail,
            '/console/customers/' || u.id AS href, s.created_at AS created_at
       FROM subscriptions s JOIN users u ON u.id = s.user_id
      ORDER BY s.created_at DESC LIMIT ?`,
    limit,
  );

  const reports = await all<ActivityItem>(
    `SELECT r.id AS id, 'report' AS kind, p.name AS title,
            r.reason AS detail, '/console/moderation/' || r.id AS href, r.created_at AS created_at
       FROM reports r JOIN portfolios p ON p.id = r.portfolio_id
      ORDER BY r.created_at DESC LIMIT ?`,
    limit,
  );

  const tickets = await all<ActivityItem>(
    `SELECT t.id AS id, 'ticket' AS kind, t.subject AS title, u.email AS detail,
            '/console/support/' || t.id AS href, t.created_at AS created_at
       FROM tickets t JOIN users u ON u.id = t.user_id
      ORDER BY t.created_at DESC LIMIT ?`,
    limit,
  );

  const audits = await all<ActivityItem>(
    `SELECT a.id AS id, 'audit' AS kind, a.action AS title,
            a.actor_email || CASE WHEN a.target_label = '' THEN '' ELSE ' → ' || a.target_label END AS detail,
            '/console/audit' AS href, a.created_at AS created_at
       FROM audit_log a ORDER BY a.created_at DESC LIMIT ?`,
    limit,
  );

  return [...signups, ...subscriptions, ...reports, ...tickets, ...audits]
    .sort((a, b) => b.created_at - a.created_at)
    .slice(0, limit);
}
