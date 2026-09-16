import "server-only";
import { cache } from "react";
import { all, get, now, run } from "./db";
import { newId } from "./ids";
import type { Ticket, TicketMessage, TicketPriority, TicketStatus, User } from "./types";

export const TICKET_STATUSES: TicketStatus[] = [
  "open",
  "in_progress",
  "waiting_customer",
  "resolved",
];

export const TICKET_PRIORITIES: TicketPriority[] = ["low", "normal", "high", "urgent"];

export {
} from "./support-labels";

/* ------------------------------------------------------------------ create */

export async function createTicket(input: {
  user: User;
  subject: string;
  category: string;
  priority?: TicketPriority;
  body: string;
}): Promise<Ticket>{
  const ts = now();
  const id = newId("tkt");
  await run(
    `INSERT INTO tickets (id, user_id, subject, category, priority, status, last_reply_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'open', ?, ?, ?)`,
    id,
    input.user.id,
    input.subject,
    input.category,
    input.priority ?? "normal",
    ts,
    ts,
    ts,
  );
  await addTicketMessage(id, input.user, input.body, false, "customer");
  return (await get<Ticket>("SELECT * FROM tickets WHERE id = ?", id))!;
}

export async function addTicketMessage(
  ticketId: string,
  author: User,
  body: string,
  internal: boolean,
  side: "customer" | "staff",
) {
  const ts = now();
  await run(
    `INSERT INTO ticket_messages (id, ticket_id, author_id, author_name, author_side, body, internal, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    newId("msg"),
    ticketId,
    author.id,
    author.display_name || author.email,
    side,
    body,
    internal ? 1 : 0,
    ts,
  );
  // Internal notes are staff-to-staff and must not look like customer activity.
  if (!internal) {
    await run("UPDATE tickets SET last_reply_at = ?, updated_at = ? WHERE id = ?", ts, ts, ticketId);
  } else {
    await run("UPDATE tickets SET updated_at = ? WHERE id = ?", ts, ticketId);
  }
}

/* ------------------------------------------------------------------ queues */

export interface TicketRow extends Ticket {
  customer_email: string;
  customer_name: string;
  assignee_email: string | null;
  message_count: number;
}

export async function listTickets(query: {
  status?: TicketStatus | "all" | "open_like";
  search?: string;
  assigneeId?: string;
  limit?: number;
  offset?: number;
} = {}) {
  const where: string[] = [];
  const params: unknown[] = [];

  if (query.status === "open_like") {
    where.push("t.status IN ('open','in_progress','waiting_customer')");
  } else if (query.status && query.status !== "all") {
    where.push("t.status = ?");
    params.push(query.status);
  }
  if (query.assigneeId) {
    where.push("t.assignee_id = ?");
    params.push(query.assigneeId);
  }
  if (query.search) {
    where.push("(t.subject ILIKE ? OR u.email ILIKE ? OR u.display_name ILIKE ?)");
    const like = `%${query.search}%`;
    params.push(like, like, like);
  }

  const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const limit = query.limit ?? 25;
  const offset = query.offset ?? 0;

  const rows = await all<TicketRow>(
    `SELECT t.*, u.email AS customer_email, u.display_name AS customer_name,
            a.email AS assignee_email,
            (SELECT COUNT(*) FROM ticket_messages m WHERE m.ticket_id = t.id AND m.internal = 0) AS message_count
       FROM tickets t
       JOIN users u ON u.id = t.user_id
       LEFT JOIN users a ON a.id = t.assignee_id
       ${clause}
      ORDER BY CASE t.status WHEN 'open' THEN 0 WHEN 'in_progress' THEN 1
               WHEN 'waiting_customer' THEN 2 ELSE 3 END,
               CASE t.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END,
               t.last_reply_at DESC
      LIMIT ? OFFSET ?`,
    ...params,
    limit,
    offset,
  );

  const total =
    (await get<{ n: number }>(
      `SELECT COUNT(*) AS n FROM tickets t JOIN users u ON u.id = t.user_id ${clause}`,
      ...params,
    ))?.n ?? 0;

  return { rows, total };
}

export async function ticketCounts(): Promise<Record<TicketStatus | "all", number>>{
  const rows = await all<{ status: TicketStatus; n: number }>(
    "SELECT status, COUNT(*) AS n FROM tickets GROUP BY status",
  );
  const counts = { open: 0, in_progress: 0, waiting_customer: 0, resolved: 0, all: 0 };
  for (const row of rows) {
    counts[row.status] = row.n;
    counts.all += row.n;
  }
  return counts;
}

export async function getTicket(id: string) {
  return await get<TicketRow>(
    `SELECT t.*, u.email AS customer_email, u.display_name AS customer_name,
            a.email AS assignee_email, 0 AS message_count
       FROM tickets t
       JOIN users u ON u.id = t.user_id
       LEFT JOIN users a ON a.id = t.assignee_id
      WHERE t.id = ?`,
    id,
  );
}

/** `includeInternal` is false for the customer's own view — never leak staff notes. */
export async function ticketMessages(ticketId: string, includeInternal: boolean) {
  return await all<TicketMessage>(
    `SELECT * FROM ticket_messages WHERE ticket_id = ? ${includeInternal ? "" : "AND internal = 0"}
      ORDER BY created_at`,
    ticketId,
  );
}

export async function ticketsForUser(userId: string) {
  return await all<Ticket>(
    "SELECT * FROM tickets WHERE user_id = ? ORDER BY last_reply_at DESC",
    userId,
  );
}

export async function setTicketField(
  ticketId: string,
  field: "status" | "priority" | "assignee_id",
  value: string | null,
) {
  await run(`UPDATE tickets SET ${field} = ?, updated_at = ? WHERE id = ?`, value, now(), ticketId);
}

async function uncachedOpenTicketCount() {
  return (
    (await get<{ n: number }>(
      "SELECT COUNT(*) AS n FROM tickets WHERE status IN ('open','in_progress','waiting_customer')",
    ))?.n ?? 0
  );
}

/**
 * Deduplicated per request.
 *
 * This is read from several independent places while one page renders — a layout,
 * a guard and the page itself all ask — and each ask was its own round trip. With
 * the database in Frankfurt and the functions in Ohio, every one of those cost
 * about a tenth of a second for an answer we already had.
 *
 * React's cache() scopes to a single request, so nothing goes stale: two renders
 * still read the database twice, one render reads it once.
 */
export const openTicketCount = cache(uncachedOpenTicketCount);
