import "server-only";
import { now, run } from "./db";
import { newId } from "./ids";
import { readSettings } from "./settings";
import { reportError } from "./observability";

export interface Mail {
  to: string;
  subject: string;
  body: string;
  kind?: string;
}

const configured = () =>
  Boolean(process.env.EMAIL_PROVIDER && process.env.EMAIL_API_KEY && process.env.EMAIL_FROM);

export const emailConfigured = configured;

/**
 * Sends transactional mail, and records every message in `mail_outbox` either way.
 *
 * With no provider configured nothing is invented: the message is stored, marked
 * undelivered, and the caller is told so — which is what lets the sign-in flow say
 * "contact the platform owner" instead of claiming an email is on its way.
 */
export async function sendMail(mail: Mail): Promise<{ delivered: boolean; error?: string }> {
  const id = newId("mail");
  const record = (delivered: boolean, error = "") =>
    run(
      `INSERT INTO mail_outbox (id, recipient, subject, body, kind, delivered, error, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      id,
      mail.to,
      mail.subject,
      mail.body,
      mail.kind ?? "transactional",
      delivered ? 1 : 0,
      error,
      now(),
    );

  if (!configured()) {
    record(false, "no email provider configured");
    return { delivered: false, error: "email_not_configured" };
  }

  try {
    const provider = process.env.EMAIL_PROVIDER!.toLowerCase();
    if (provider !== "resend") {
      throw new Error(
        `EMAIL_PROVIDER "${provider}" has no adapter. Implement one in src/lib/mailer.ts.`,
      );
    }

    const settings = readSettings();
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.EMAIL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM,
        to: [mail.to],
        reply_to: settings["brand.support_email"] || undefined,
        subject: mail.subject,
        text: mail.body,
      }),
    });

    if (!response.ok) {
      throw new Error(`provider responded ${response.status}: ${await response.text()}`);
    }

    record(true);
    return { delivered: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    record(false, message.slice(0, 500));
    reportError(error, { area: "mailer", recipient: mail.to, subject: mail.subject });
    return { delivered: false, error: message };
  }
}
