import "server-only";
import { all, get, now, run } from "./db";
import { newId } from "./ids";
import type { Portfolio, Report, ReportStatus, User } from "./types";

export const REPORT_STATUSES: ReportStatus[] = ["pending", "reviewing", "resolved", "dismissed"];

const REPORT_STATUS_LABEL_AR: Record<ReportStatus, string> = {
  pending: "قيد الانتظار",
  reviewing: "تحت المراجعة",
  resolved: "تمت المعالجة",
  dismissed: "مرفوض",
};

const REPORT_STATUS_LABEL_EN: Record<ReportStatus, string> = {
  pending: "Waiting",
  reviewing: "Under review",
  resolved: "Handled",
  dismissed: "Dismissed",
};

/** A report's state in the reader's language. */
export const reportStatusLabel = (status: ReportStatus, locale: string) =>
  (locale === "en" ? REPORT_STATUS_LABEL_EN : REPORT_STATUS_LABEL_AR)[status] ?? status;

/* --------------------------------------------------------------- reporting */

export async function createReport(input: {
  portfolioId: string;
  reporterId?: string | null;
  reporterEmail: string;
  reason: string;
  description: string;
  evidenceUrl?: string;
}): Promise<Report>{
  const ts = now();
  const id = newId("rep");
  await run(
    `INSERT INTO reports (id, portfolio_id, reporter_id, reporter_email, reason, description,
       evidence_url, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
    id,
    input.portfolioId,
    input.reporterId ?? null,
    input.reporterEmail,
    input.reason,
    input.description,
    input.evidenceUrl ?? "",
    ts,
    ts,
  );
  return (await get<Report>("SELECT * FROM reports WHERE id = ?", id))!;
}

/** Stops one person filing the same complaint about the same page repeatedly. */
export async function hasRecentReport(portfolioId: string, reporterEmail: string, withinMs = 86_400_000) {
  return Boolean(
    await get<{ id: string }>(
      "SELECT id FROM reports WHERE portfolio_id = ? AND reporter_email = ? AND created_at > ?",
      portfolioId,
      reporterEmail,
      now() - withinMs,
    ),
  );
}

/* ------------------------------------------------------------------- queue */

export interface ReportRow extends Report {
  portfolio_name: string;
  portfolio_slug: string;
  portfolio_suspended: number;
  owner_email: string;
  owner_id: string;
  assignee_email: string | null;
  note_count: number;
}

export async function listReports(query: {
  status?: ReportStatus | "all";
  search?: string;
  limit?: number;
  offset?: number;
} = {}) {
  const where: string[] = [];
  const params: unknown[] = [];

  if (query.status && query.status !== "all") {
    where.push("r.status = ?");
    params.push(query.status);
  }
  if (query.search) {
    where.push("(p.name ILIKE ? OR p.slug ILIKE ? OR r.reporter_email ILIKE ? OR r.description ILIKE ?)");
    const like = `%${query.search}%`;
    params.push(like, like, like, like);
  }

  const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const limit = query.limit ?? 25;
  const offset = query.offset ?? 0;

  const rows = await all<ReportRow>(
    `SELECT r.*, p.name AS portfolio_name, p.slug AS portfolio_slug,
            p.suspended AS portfolio_suspended, u.email AS owner_email, u.id AS owner_id,
            a.email AS assignee_email,
            (SELECT COUNT(*) FROM report_notes n WHERE n.report_id = r.id) AS note_count
       FROM reports r
       JOIN portfolios p ON p.id = r.portfolio_id
       JOIN users u ON u.id = p.user_id
       LEFT JOIN users a ON a.id = r.assignee_id
       ${clause}
      ORDER BY CASE r.status WHEN 'pending' THEN 0 WHEN 'reviewing' THEN 1 ELSE 2 END,
               r.created_at DESC
      LIMIT ? OFFSET ?`,
    ...params,
    limit,
    offset,
  );

  const total =
    (await get<{ n: number }>(
      `SELECT COUNT(*) AS n FROM reports r JOIN portfolios p ON p.id = r.portfolio_id ${clause}`,
      ...params,
    ))?.n ?? 0;

  return { rows, total };
}

export async function reportCounts(): Promise<Record<ReportStatus | "all", number>>{
  const rows = await all<{ status: ReportStatus; n: number }>(
    "SELECT status, COUNT(*) AS n FROM reports GROUP BY status",
  );
  const counts = { pending: 0, reviewing: 0, resolved: 0, dismissed: 0, all: 0 };
  for (const row of rows) {
    counts[row.status] = row.n;
    counts.all += row.n;
  }
  return counts;
}

export async function getReport(id: string) {
  return await get<ReportRow>(
    `SELECT r.*, p.name AS portfolio_name, p.slug AS portfolio_slug,
            p.suspended AS portfolio_suspended, u.email AS owner_email, u.id AS owner_id,
            a.email AS assignee_email, 0 AS note_count
       FROM reports r
       JOIN portfolios p ON p.id = r.portfolio_id
       JOIN users u ON u.id = p.user_id
       LEFT JOIN users a ON a.id = r.assignee_id
      WHERE r.id = ?`,
    id,
  );
}

export async function reportsForPortfolio(portfolioId: string) {
  return await all<Report>(
    "SELECT * FROM reports WHERE portfolio_id = ? ORDER BY created_at DESC",
    portfolioId,
  );
}

/* ------------------------------------------------------------------- notes */

export interface ReportNote {
  id: string;
  report_id: string;
  author_id: string | null;
  author_name: string;
  body: string;
  created_at: number;
}

export async function addReportNote(reportId: string, author: User, body: string) {
  await run(
    "INSERT INTO report_notes (id, report_id, author_id, author_name, body, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    newId("rnt"),
    reportId,
    author.id,
    author.display_name || author.email,
    body,
    now(),
  );
  await run("UPDATE reports SET updated_at = ? WHERE id = ?", now(), reportId);
}

export async function reportNotes(reportId: string) {
  return await all<ReportNote>(
    "SELECT * FROM report_notes WHERE report_id = ? ORDER BY created_at",
    reportId,
  );
}

/* ------------------------------------------------------------- transitions */

export async function setReportStatus(reportId: string, status: ReportStatus, resolution = "") {
  await run(
    `UPDATE reports SET status = ?, resolution = CASE WHEN ? = '' THEN resolution ELSE ? END,
       resolved_at = CASE WHEN ? IN ('resolved','dismissed') THEN ? ELSE NULL END, updated_at = ?
     WHERE id = ?`,
    status,
    resolution,
    resolution,
    status,
    now(),
    now(),
    reportId,
  );
}

export async function assignReport(reportId: string, assigneeId: string | null) {
  await run(
    `UPDATE reports SET assignee_id = ?, status = CASE WHEN status = 'pending' AND ? IS NOT NULL
       THEN 'reviewing' ELSE status END, updated_at = ? WHERE id = ?`,
    assigneeId,
    assigneeId,
    now(),
    reportId,
  );
}

/* -------------------------------------------------------------- enforcement */

/**
 * Suspension hides a portfolio from the public without touching its content: the
 * client keeps every project, image and setting, and the moderation history stays
 * attached to the account.
 */
export async function suspendPortfolio(portfolioId: string, reason: string, untilMs: number | null) {
  await run(
    "UPDATE portfolios SET suspended = 1, suspended_reason = ?, suspended_at = ?, suspended_until = ?, updated_at = ? WHERE id = ?",
    reason,
    now(),
    untilMs,
    now(),
    portfolioId,
  );
}

export async function restorePortfolio(portfolioId: string) {
  await run(
    "UPDATE portfolios SET suspended = 0, suspended_reason = '', suspended_at = NULL, suspended_until = NULL, updated_at = ? WHERE id = ?",
    now(),
    portfolioId,
  );
}

/**
 * A temporary suspension lifts itself the first time anyone looks at the page,
 * so no scheduler is needed for the common case.
 */
export async function liftExpiredSuspension(portfolio: Portfolio): Promise<boolean>{
  if (portfolio.suspended !== 1 || !portfolio.suspended_until) return false;
  if (portfolio.suspended_until > now()) return false;
  await restorePortfolio(portfolio.id);
  return true;
}
