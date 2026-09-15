import "server-only";
import { all, get, now } from "./db";
import { churnRate, revenueSnapshot } from "./analytics";
import { openTicketCount } from "./support";
import { reportCounts } from "./moderation";

const DAY = 86_400_000;
const count = (sql: string, ...params: unknown[]) =>
  get<{ n: number }>(sql, ...params)?.n ?? 0;

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

export function platformStats(): PlatformStats {
  const ts = now();
  const revenue = revenueSnapshot();
  const reports = reportCounts();

  const totalUsers = count("SELECT COUNT(*) AS n FROM users WHERE role = 'client'");
  const activeSubscriptions = count(
    `SELECT COUNT(DISTINCT user_id) AS n FROM subscriptions
      WHERE status = 'active' AND (current_period_end IS NULL OR current_period_end > ?)`,
    ts,
  );

  return {
    totalUsers,
    // "Active" means seen in the last 30 days, which is what a session touch records.
    activeUsers: count(
      "SELECT COUNT(*) AS n FROM users WHERE role = 'client' AND last_seen_at >= ?",
      ts - 30 * DAY,
    ),
    newThisWeek: count(
      "SELECT COUNT(*) AS n FROM users WHERE role = 'client' AND created_at >= ?",
      ts - 7 * DAY,
    ),
    newThisMonth: count(
      "SELECT COUNT(*) AS n FROM users WHERE role = 'client' AND created_at >= ?",
      ts - 30 * DAY,
    ),
    activeSubscriptions,
    monthlySubscribers: revenue.monthlyCount,
    yearlySubscribers: revenue.yearlyCount,
    compedSubscribers: revenue.compedCount,
    freeUsers: Math.max(0, totalUsers - activeSubscriptions),
    suspendedUsers: count("SELECT COUNT(*) AS n FROM users WHERE status = 'suspended'"),
    suspendedPortfolios: count("SELECT COUNT(*) AS n FROM portfolios WHERE suspended = 1"),
    endedSubscriptions: count(
      "SELECT COUNT(*) AS n FROM subscriptions WHERE status IN ('canceled','expired')",
    ),
    mrr: revenue.mrr,
    arr: revenue.arr,
    churnPercent: churnRate(30).percent,
    openTickets: openTicketCount(),
    pendingReports: reports.pending + reports.reviewing,
    publishedPortfolios: count("SELECT COUNT(*) AS n FROM portfolios WHERE published = 1"),
    totalPortfolios: count("SELECT COUNT(*) AS n FROM portfolios"),
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
export function recentActivity(limit = 14): ActivityItem[] {
  const signups = all<ActivityItem>(
    `SELECT u.id AS id, 'signup' AS kind, u.display_name AS title, u.email AS detail,
            '/console/customers/' || u.id AS href, u.created_at AS created_at
       FROM users u WHERE u.role = 'client' ORDER BY u.created_at DESC LIMIT ?`,
    limit,
  );

  const subscriptions = all<ActivityItem>(
    `SELECT s.id AS id, 'subscription' AS kind,
            CASE s.plan WHEN 'monthly' THEN 'اشتراك شهري' ELSE 'اشتراك سنوي' END AS title,
            u.email || ' · ' || s.source AS detail,
            '/console/customers/' || u.id AS href, s.created_at AS created_at
       FROM subscriptions s JOIN users u ON u.id = s.user_id
      ORDER BY s.created_at DESC LIMIT ?`,
    limit,
  );

  const reports = all<ActivityItem>(
    `SELECT r.id AS id, 'report' AS kind, 'بلاغ عن ' || p.name AS title,
            r.reason AS detail, '/console/moderation/' || r.id AS href, r.created_at AS created_at
       FROM reports r JOIN portfolios p ON p.id = r.portfolio_id
      ORDER BY r.created_at DESC LIMIT ?`,
    limit,
  );

  const tickets = all<ActivityItem>(
    `SELECT t.id AS id, 'ticket' AS kind, t.subject AS title, u.email AS detail,
            '/console/support/' || t.id AS href, t.created_at AS created_at
       FROM tickets t JOIN users u ON u.id = t.user_id
      ORDER BY t.created_at DESC LIMIT ?`,
    limit,
  );

  const audits = all<ActivityItem>(
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
