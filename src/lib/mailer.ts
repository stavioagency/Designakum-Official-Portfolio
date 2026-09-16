import "server-only";
import { now, run } from "./db";
import { newId } from "./ids";
import { readSettings } from "./settings";
import { siteUrl } from "./site";
import { toHtml, type Block } from "./email-render";
import { EMAIL_LOGO } from "./email-logo";
import type { Locale } from "./types";
import { reportError } from "./observability";

export interface Mail {
  to: string;
  subject: string;
  /** Plain text. Always sent, and the only thing `mail_outbox` keeps. */
  body: string;
  kind?: string;
  /**
   * The message as blocks. Present, it is rendered to a branded HTML part and
   * sent alongside the text; absent, the mail goes out as text alone. Spreading
   * a composed template supplies these three without the caller naming them.
   */
  blocks?: Block[];
  locale?: Locale;
  preheader?: string;
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
  const record = async (delivered: boolean, error = "") =>
    await run(
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
    await record(false, "no email provider configured");
    return { delivered: false, error: "email_not_configured" };
  }

  try {
    const provider = process.env.EMAIL_PROVIDER!.toLowerCase();
    if (provider !== "resend") {
      throw new Error(
        `EMAIL_PROVIDER "${provider}" has no adapter. Implement one in src/lib/mailer.ts.`,
      );
    }

    const settings = await readSettings();

    // The HTML half carries a logo, so it needs an absolute origin — a mail
    // client has no page to resolve a relative path against. A webhook has no
    // request either, which is why this is `siteUrl()` and not the origin of
    // whatever happened to trigger the send.
    const html = mail.blocks?.length
      ? toHtml(mail.blocks, {
          locale: mail.locale ?? "ar",
          origin: await siteUrl(),
          preheader: mail.preheader,
          supportEmail: settings["brand.support_email"] || undefined,
          logoSrc: `cid:${EMAIL_LOGO.cid}`,
        })
      : undefined;

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
        html,
        // Only when there is an HTML part to show it in. Attached to a text-only
        // message it would arrive as a stray file with no way to display it.
        attachments: html
          ? [
              {
                filename: EMAIL_LOGO.filename,
                content: EMAIL_LOGO.base64,
                content_type: EMAIL_LOGO.contentType,
                content_id: EMAIL_LOGO.cid,
              },
            ]
          : undefined,
      }),
    });

    if (!response.ok) {
      throw new Error(`provider responded ${response.status}: ${await response.text()}`);
    }

    await record(true);
    return { delivered: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await record(false, message.slice(0, 500));
    reportError(error, { area: "mailer", recipient: mail.to, subject: mail.subject });
    return { delivered: false, error: message };
  }
}
