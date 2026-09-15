import "server-only";
import { all, get, now, run } from "./db";
import { newId } from "./ids";
import type { User } from "./types";

export interface AuditEntry {
  id: string;
  actor_id: string | null;
  actor_email: string;
  actor_role: string;
  action: string;
  target_type: string;
  target_id: string;
  target_label: string;
  before_state: string;
  after_state: string;
  detail: string;
  created_at: number;
}

/**
 * Every consequential staff action lands here. Writes are deliberately
 * fire-and-forget from the caller's point of view but synchronous in practice, so
 * an action can never succeed without its audit row.
 */
export function audit(input: {
  actor: User;
  action: string;
  targetType?: string;
  targetId?: string;
  targetLabel?: string;
  before?: unknown;
  after?: unknown;
  detail?: string;
}) {
  const asText = (value: unknown) =>
    value === undefined || value === null
      ? ""
      : typeof value === "string"
        ? value
        : JSON.stringify(value);

  run(
    `INSERT INTO audit_log (id, actor_id, actor_email, actor_role, action, target_type,
       target_id, target_label, before_state, after_state, detail, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    newId("aud"),
    input.actor.id,
    input.actor.email,
    input.actor.role,
    input.action,
    input.targetType ?? "",
    input.targetId ?? "",
    input.targetLabel ?? "",
    asText(input.before),
    asText(input.after),
    input.detail ?? "",
    now(),
  );
}

export interface AuditQuery {
  search?: string;
  action?: string;
  actorId?: string;
  targetId?: string;
  limit?: number;
  offset?: number;
}

export function queryAudit(query: AuditQuery = {}) {
  const where: string[] = [];
  const params: unknown[] = [];

  if (query.search) {
    where.push(
      "(actor_email LIKE ? OR action LIKE ? OR target_label LIKE ? OR detail LIKE ? OR target_id LIKE ?)",
    );
    const like = `%${query.search}%`;
    params.push(like, like, like, like, like);
  }
  if (query.action) {
    where.push("action = ?");
    params.push(query.action);
  }
  if (query.actorId) {
    where.push("actor_id = ?");
    params.push(query.actorId);
  }
  if (query.targetId) {
    where.push("target_id = ?");
    params.push(query.targetId);
  }

  const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const limit = query.limit ?? 50;
  const offset = query.offset ?? 0;

  const rows = all<AuditEntry>(
    `SELECT * FROM audit_log ${clause} ORDER BY created_at DESC, rowid DESC LIMIT ? OFFSET ?`,
    ...params,
    limit,
    offset,
  );
  const total =
    get<{ n: number }>(`SELECT COUNT(*) AS n FROM audit_log ${clause}`, ...params)?.n ?? 0;

  return { rows, total };
}

export function auditActions(): string[] {
  return all<{ action: string }>(
    "SELECT DISTINCT action FROM audit_log ORDER BY action",
  ).map((r) => r.action);
}

/** Everything ever done to one customer, for the account-history tab. */
export function auditForTarget(targetId: string, limit = 50) {
  return all<AuditEntry>(
    "SELECT * FROM audit_log WHERE target_id = ? ORDER BY created_at DESC LIMIT ?",
    targetId,
    limit,
  );
}
