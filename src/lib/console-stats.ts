import "server-only";
import { all, get, now } from "./db";
import { churnRate, revenueSnapshot } from "./analytics";
import { openTicketCount } from "./support";
import { reportCounts } from "./moderation";

const DAY = 86_400_000;
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
 * Every count on the console overview, in one statement.
 *
 * These were fourteen separate queries. Concurrency helped, but the pool is
 * deliberately small — it is a budget shared with every other warm instance —
 * so they still went out a couple at a time, and each batch is a round trip to
 * another continent.
 *
 * Postgres will compute fourteen scalar subqueries in a single pass over the
 * same small tables far faster than the network can carry fourteen questions.
 * One round trip, and the counts are consistent with each other because they
 * see one snapshot rather than fourteen.
 */
export async function platformStats(): Promise<PlatformStats>{
  const ts = now();
  const month = ts - 30 * DAY;
  const week = ts - 7 * DAY;

  const [counts, revenue, reports, churn, openTickets] = await Promise.all([
    get<{
      total_users: number;
      active_users: number;
      new_this_week: number;
      new_this_month: number;
      active_subscriptions: number;
      suspended_users: number;
      suspended_portfolios: number;
      ended_subscriptions: number;
      published_portfolios: number;
      total_portfolios: number;
    }>(
      `SELECT
         (SELECT COUNT(*) FROM users WHERE role = 'client')::int AS total_users,
         (SELECT COUNT(*) FROM users WHERE role = 'client' AND last_seen_at >= ?)::int AS active_users,
         (SELECT COUNT(*) FROM users WHERE role = 'client' AND created_at >= ?)::int AS new_this_week,
         (SELECT COUNT(*) FROM users WHERE role = 'client' AND created_at >= ?)::int AS new_this_month,
         -- Customers, not accounts. Without the role filter this counted staff
         -- who had granted themselves a plan, and came out larger than
         -- total_users beside it, which filters to clients.
         (SELECT COUNT(DISTINCT s.user_id) FROM subscriptions s
            JOIN users u ON u.id = s.user_id AND u.role = 'client'
           WHERE s.status = 'active' AND (s.current_period_end IS NULL OR s.current_period_end > ?))::int
           AS active_subscriptions,
         (SELECT COUNT(*) FROM users WHERE role = 'client' AND status = 'suspended')::int AS suspended_users,
         (SELECT COUNT(*) FROM portfolios WHERE suspended = 1)::int AS suspended_portfolios,
         (SELECT COUNT(*) FROM subscriptions s
            JOIN users u ON u.id = s.user_id AND u.role = 'client'
           WHERE s.status IN ('canceled','expired'))::int
           AS ended_subscriptions,
         (SELECT COUNT(*) FROM portfolios WHERE published = 1)::int AS published_portfolios,
         (SELECT COUNT(*) FROM portfolios)::int AS total_portfolios`,
      month,
      week,
      month,
      ts,
    ),
    revenueSnapshot(),
    reportCounts(),
    churnRate(30),
    openTicketCount(),
  ]);

  const totalUsers = counts?.total_users ?? 0;
  const activeSubscriptions = counts?.active_subscriptions ?? 0;

  return {
    totalUsers,
    // "Active" means seen in the last 30 days, which is what a session touch records.
    activeUsers: counts?.active_users ?? 0,
    newThisWeek: counts?.new_this_week ?? 0,
    newThisMonth: counts?.new_this_month ?? 0,
    activeSubscriptions,
    monthlySubscribers: revenue.monthlyCount,
    yearlySubscribers: revenue.yearlyCount,
    compedSubscribers: revenue.compedCount,
    /**
     * Both sides count customers now. The clamp stays as a floor rather than a
     * fix: it was hiding the mismatch that made this negative — more
     * subscribers than customers — by quietly reporting zero.
     */
    freeUsers: Math.max(0, totalUsers - activeSubscriptions),
    suspendedUsers: counts?.suspended_users ?? 0,
    suspendedPortfolios: counts?.suspended_portfolios ?? 0,
    endedSubscriptions: counts?.ended_subscriptions ?? 0,
    mrr: revenue.mrr,
    arr: revenue.arr,
    churnPercent: churn.percent,
    openTickets,
    pendingReports: reports.pending + reports.reviewing,
    publishedPortfolios: counts?.published_portfolios ?? 0,
    totalPortfolios: counts?.total_portfolios ?? 0,
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
