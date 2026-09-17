import test, { after, before, describe } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { CONNECTION_STRING, closePool, db } from "./helpers.mjs";

// The app's modules read both of these from the environment.
process.env.DATABASE_URL ??= CONNECTION_STRING;
process.env.SITE_URL ??= "http://localhost:3000";

const d = db();
const now = () => Date.now();
const tickets = [];

async function customer() {
  return await d.prepare("SELECT * FROM users WHERE role = 'client' ORDER BY created_at LIMIT 1").get();
}

async function openTicket(userId, subject = "Test ticket") {
  const id = `tkt_test_${randomBytes(6).toString("hex")}`;
  tickets.push(id);
  const ts = now();
  await d
    .prepare(
      `INSERT INTO tickets (id, user_id, subject, category, priority, status, last_reply_at, created_at, updated_at)
       VALUES (?, ?, ?, 'general', 'normal', 'open', ?, ?, ?)`,
    )
    .run(id, userId, subject, ts, ts, ts);
  return id;
}

const mailFor = async (recipient, since) =>
  await d
    .prepare(
      "SELECT COUNT(*) AS n FROM mail_outbox WHERE recipient = ? AND kind = 'ticket_resolved' AND created_at >= ?",
    )
    .get(recipient, since);

after(async () => {
  for (const id of tickets) {
    await d.prepare("DELETE FROM ticket_messages WHERE ticket_id = ?").run(id);
    await d.prepare("DELETE FROM tickets WHERE id = ?").run(id);
  }
  await d.prepare("DELETE FROM mail_outbox WHERE kind = 'ticket_resolved' AND subject LIKE '%Test ticket%'").run();
  await closePool();
});

describe("resolving a ticket", () => {
  test("the person who opened it is told, once", async () => {
    const { notifyTicketResolved } = await import("../src/lib/ticket-mail.ts");
    const user = await customer();
    const id = await openTicket(user.id, "Test ticket one");
    const ticket = await d.prepare("SELECT * FROM tickets WHERE id = ?").get(id);
    const since = now();

    await notifyTicketResolved(ticket);

    const sent = await mailFor(user.email, since);
    assert.equal(Number(sent.n), 1, "exactly one resolution email");
  });

  test("the message names the ticket, so several tickets stay distinguishable", async () => {
    const { notifyTicketResolved } = await import("../src/lib/ticket-mail.ts");
    const user = await customer();
    const id = await openTicket(user.id, "Test ticket subject marker");
    const ticket = await d.prepare("SELECT * FROM tickets WHERE id = ?").get(id);

    await notifyTicketResolved(ticket);

    const row = await d
      .prepare(
        "SELECT subject, body FROM mail_outbox WHERE kind = 'ticket_resolved' AND recipient = ? ORDER BY created_at DESC LIMIT 1",
      )
      .get(user.email);
    assert.match(row.subject, /Test ticket subject marker/);
    assert.match(row.body, new RegExp(id), "the body links to this ticket");
  });

});
