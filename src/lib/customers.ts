import "server-only";
import { all, get } from "./db";
import type { Portfolio, User } from "./types";

export interface CustomerRow {
  id: string;
  email: string;
  display_name: string;
  status: string;
  plan: string;
  role: string;
  auth_provider: string;
  created_at: number;
  last_seen_at: number | null;
  portfolio_id: string | null;
  portfolio_name: string | null;
  slug: string | null;
  published: number | null;
  suspended: number | null;
  views: number | null;
  subscription_plan: string | null;
  subscription_status: string | null;
  subscription_source: string | null;
  period_end: number | null;
  open_reports: number;
  open_tickets: number;
}

export type CustomerFilter = {
  search?: string;
  plan?: "all" | "free" | "monthly" | "yearly";
  status?: "all" | "active" | "suspended" | "portfolio_suspended";
  since?: number;
  sort?: "recent" | "views" | "name";
  limit?: number;
  offset?: number;
};

/**
 * One query behind the customer list: the newest subscription per user is joined
 * in a correlated subquery so filtering by plan reflects the live subscription
 * rather than the cached `users.plan` mirror.
 */
export function listCustomers(filter: CustomerFilter = {}) {
  const where: string[] = ["u.role = 'client'"];
  const params: unknown[] = [];

  if (filter.search) {
    where.push("(u.email LIKE ? OR u.display_name LIKE ? OR p.name LIKE ? OR p.slug LIKE ?)");
    const like = `%${filter.search}%`;
    params.push(like, like, like, like);
  }
  if (filter.plan && filter.plan !== "all") {
    where.push(
      filter.plan === "free"
        ? "(s.id IS NULL OR s.status <> 'active')"
        : "(s.plan = ? AND s.status = 'active')",
    );
    if (filter.plan !== "free") params.push(filter.plan);
  }
  if (filter.status === "active") where.push("u.status = 'active'");
  if (filter.status === "suspended") where.push("u.status = 'suspended'");
  if (filter.status === "portfolio_suspended") where.push("p.suspended = 1");
  if (filter.since) {
    where.push("u.created_at >= ?");
    params.push(filter.since);
  }

  const order =
    filter.sort === "views"
      ? "p.views DESC"
      : filter.sort === "name"
        ? "u.display_name COLLATE NOCASE"
        : "u.created_at DESC";

  const base = `
    FROM users u
    LEFT JOIN portfolios p ON p.user_id = u.id
    LEFT JOIN subscriptions s ON s.id = (
      SELECT s2.id FROM subscriptions s2 WHERE s2.user_id = u.id
       ORDER BY s2.created_at DESC, s2.rowid DESC LIMIT 1)
    WHERE ${where.join(" AND ")}`;

  const rows = all<CustomerRow>(
    `SELECT u.id, u.email, u.display_name, u.status, u.plan, u.role, u.auth_provider,
            u.created_at, u.last_seen_at,
            p.id AS portfolio_id, p.name AS portfolio_name, p.slug, p.published, p.suspended, p.views,
            s.plan AS subscription_plan, s.status AS subscription_status,
            s.source AS subscription_source, s.current_period_end AS period_end,
            (SELECT COUNT(*) FROM reports r WHERE r.portfolio_id = p.id
              AND r.status IN ('pending','reviewing')) AS open_reports,
            (SELECT COUNT(*) FROM tickets t WHERE t.user_id = u.id
              AND t.status <> 'resolved') AS open_tickets
     ${base}
     ORDER BY ${order}
     LIMIT ? OFFSET ?`,
    ...params,
    filter.limit ?? 20,
    filter.offset ?? 0,
  );

  const total = get<{ n: number }>(`SELECT COUNT(*) AS n ${base}`, ...params)?.n ?? 0;

  return { rows, total };
}

export function getCustomer(id: string) {
  return get<User>("SELECT * FROM users WHERE id = ?", id);
}

export function portfolioOf(userId: string) {
  return get<Portfolio>(
    "SELECT * FROM portfolios WHERE user_id = ? ORDER BY created_at LIMIT 1",
    userId,
  );
}

export function staffMembers() {
  return all<User>(
    "SELECT * FROM users WHERE role IN ('owner','support') ORDER BY role, created_at",
  );
}
