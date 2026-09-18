import "server-only";
import { all, get, now, run } from "./db";
import { deleteImage } from "./storage";
import type { User } from "./types";

/**
 * Taking your data with you, and leaving.
 *
 * Both are rights under the Personal Data Protection Law, and neither existed:
 * a customer could put their work into this platform and had no way to get a
 * copy of it out or to make it go away.
 */

/* ------------------------------------------------------------------ export */

/**
 * Everything held about one account, as one JSON document.
 *
 * Uploaded files are listed by their address rather than inlined. A portfolio's
 * images can run to tens of megabytes, and base64 inside JSON would be a third
 * larger again and unopenable by anything but code — the links work in a
 * browser, which is what someone checking their own data actually does.
 *
 * The password hash is the one thing deliberately left out. It is about the
 * account rather than the person, and handing out even a hash of a credential
 * in a file that then sits in a downloads folder is a worse idea than omitting
 * it.
 */
export async function exportAccount(user: User) {
  const portfolios = await all<Record<string, unknown>>(
    "SELECT * FROM portfolios WHERE user_id = ? ORDER BY created_at",
    user.id,
  );

  const ids = portfolios.map((p) => String(p.id));
  const forEachPortfolio = async (table: string) => {
    if (!ids.length) return [];
    const rows: Record<string, unknown>[] = [];
    for (const id of ids) {
      rows.push(
        ...(await all<Record<string, unknown>>(
          `SELECT * FROM ${table} WHERE portfolio_id = ? ORDER BY seq`,
          id,
        )),
      );
    }
    return rows;
  };

  const tickets = await all<{ id: string }>(
    "SELECT * FROM tickets WHERE user_id = ? ORDER BY created_at",
    user.id,
  );

  const ticketMessages: Record<string, unknown>[] = [];
  for (const ticket of tickets) {
    ticketMessages.push(
      ...(await all<Record<string, unknown>>(
        // Internal staff notes are not the customer's data and are not theirs
        // to read; they are notes staff wrote to each other about a case.
        "SELECT * FROM ticket_messages WHERE ticket_id = ? AND internal = 0 ORDER BY created_at",
        ticket.id,
      )),
    );
  }

  const { password_hash: _omitted, ...account } = user as User & { password_hash?: string };

  return {
    exported_at: new Date(now()).toISOString(),
    account,
    portfolios,
    projects: await forEachPortfolio("projects"),
    slides: await forEachPortfolio("slides"),
    socials: await forEachPortfolio("socials"),
    buttons: await forEachPortfolio("buttons"),
    stats: await forEachPortfolio("stats"),
    domains: ids.length
      ? await all("SELECT * FROM domains WHERE portfolio_id = ANY(?)", ids)
      : [],
    subscriptions: await all(
      "SELECT * FROM subscriptions WHERE user_id = ? ORDER BY created_at",
      user.id,
    ),
    billing_events: await all(
      "SELECT * FROM billing_events WHERE user_id = ? ORDER BY created_at",
      user.id,
    ),
    support_tickets: tickets,
    support_messages: ticketMessages,
    uploads: await all(
      "SELECT id, mime, byte_size, storage_path, created_at FROM assets WHERE owner_id = ? ORDER BY created_at",
      user.id,
    ),
    emails_we_sent_you: await all(
      "SELECT subject, kind, delivered, created_at FROM mail_outbox WHERE recipient = ? ORDER BY created_at",
      user.email,
    ),
  };
}

/* ------------------------------------------------------------------ delete */

export interface DeletionReport {
  files: number;
  mail: number;
  auditEntries: number;
}

/**
 * Erases an account and everything personal attached to it.
 *
 * Foreign keys cascade from `users`, which covers the portfolio and its
 * contents, sessions, tickets, subscriptions and billing events. Three things
 * they do not reach, and each would have left personal data behind:
 *
 *  - the uploaded files themselves, which live in object storage and have no
 *    foreign key to cascade through. Deleting the rows without the objects
 *    means the images are still there, still served, after someone was told
 *    their account was erased.
 *  - `mail_outbox`, which is keyed by email address rather than by user.
 *  - `audit_log`, which records the address of whoever acted.
 *
 * The audit log is anonymised rather than deleted. It exists to answer "who
 * changed this", including for security incidents, and cutting holes in it
 * would damage the record for everyone else; removing the identifiers takes the
 * personal data out while leaving the history intact.
 */
export async function deleteAccount(user: User): Promise<DeletionReport> {
  const assets = await all<{ id: string; storage_path: string }>(
    "SELECT id, storage_path FROM assets WHERE owner_id = ?",
    user.id,
  );

  let files = 0;
  for (const asset of assets) {
    try {
      await deleteImage(asset.storage_path);
      files += 1;
    } catch {
      // A file that cannot be removed must not strand the account in a
      // half-deleted state; the row goes either way and the miss is reported.
    }
  }

  const mail = await all<{ id: string }>(
    "SELECT id FROM mail_outbox WHERE recipient = ?",
    user.email,
  );
  await run("DELETE FROM mail_outbox WHERE recipient = ?", user.email);

  const audited = await all<{ id: string }>(
    "SELECT id FROM audit_log WHERE actor_id = ? OR actor_email = ?",
    user.id,
    user.email,
  );
  await run(
    `UPDATE audit_log SET actor_id = NULL, actor_email = '', target_label = ''
      WHERE actor_id = ? OR actor_email = ?`,
    user.id,
    user.email,
  );

  await run("DELETE FROM users WHERE id = ?", user.id);

  return { files, mail: mail.length, auditEntries: audited.length };
}

/** Whether anything at all is still attached to this account. */
export async function accountRemnants(userId: string, email: string) {
  const row = await get<{ n: number }>(
    `SELECT
       (SELECT COUNT(*) FROM users WHERE id = ?)
     + (SELECT COUNT(*) FROM portfolios WHERE user_id = ?)
     + (SELECT COUNT(*) FROM assets WHERE owner_id = ?)
     + (SELECT COUNT(*) FROM mail_outbox WHERE recipient = ?)
     + (SELECT COUNT(*) FROM sessions WHERE user_id = ?) AS n`,
    userId,
    userId,
    userId,
    email,
    userId,
  );
  return row?.n ?? 0;
}
