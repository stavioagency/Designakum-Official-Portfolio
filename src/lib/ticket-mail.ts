import "server-only";
import { get } from "./db";
import { emailTemplate } from "./emails";
import { sendMail } from "./mailer";
import { reportError } from "./observability";
import { siteUrl } from "./site";
import type { Ticket, User } from "./types";

/**
 * Tells the person who opened a ticket that it has been resolved.
 *
 * Only when support resolves it. A customer who closes their own ticket already
 * knows, and mailing them about something they just did reads as a system that
 * is not paying attention.
 *
 * Never fatal: the ticket is already resolved by the time this runs, and a mail
 * provider having a bad minute is not a reason to fail the action or to leave
 * the ticket in a state that does not match what the console shows.
 */
export async function notifyTicketResolved(ticket: Ticket) {
  try {
    const user = await get<User>("SELECT * FROM users WHERE id = ?", ticket.user_id);
    if (!user) return;

    const origin = await siteUrl();
    const composed = emailTemplate.ticketResolved(user.locale, {
      name: user.display_name || "",
      subject: ticket.subject,
      ticketUrl: `${origin}/dashboard/support/${ticket.id}`,
    });

    await sendMail({ to: user.email, kind: "ticket_resolved", ...composed });
  } catch (error) {
    reportError(error, { area: "ticket-resolved-email", ticketId: ticket.id });
  }
}
