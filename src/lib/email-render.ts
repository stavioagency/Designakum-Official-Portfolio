import type { Locale } from "./types";

/**
 * Turns a message into the two bodies every email needs: plain text and HTML.
 *
 * Templates describe *what* a message says as a list of blocks; this file is the
 * only thing that decides how it looks. That split is what keeps the two bodies
 * from drifting — there is one copy of the words, rendered twice, so a wording
 * change cannot land in the HTML and be forgotten in the text.
 *
 * The text half is still sent with every message. It is what shows up in the
 * clients that refuse HTML, in notification previews, and in `mail_outbox` where
 * the owner reads back what was sent. It also keeps the property the plain-text
 * era was chosen for: no tracking pixel, because there is nothing to hide one in.
 */

export type Block =
  | { type: "h"; text: string }
  | { type: "p"; text: string }
  | { type: "cta"; label: string; url: string }
  | { type: "code"; label: string; value: string }
  | { type: "link"; label: string; url: string }
  | { type: "facts"; rows: [string, string][] }
  | { type: "note"; text: string };

/* ------------------------------------------------------------------ palette */

/**
 * Lifted from globals.css rather than imported: an email cannot carry a
 * stylesheet, so every value has to be written into the markup inline. These are
 * copies, and the comment is the only thing keeping them honest.
 */
const C = {
  page: "#07080e", // ink-950
  card: "#10121d", // ink-850
  well: "#151824", // ink-800
  line: "#1c2030", // ink-700
  bright: "#f6f6fb", // mist-50
  body: "#b9b9cc", // mist-300
  muted: "#6e6e85", // mist-500
  accent: "#2563c9", // brand-500
  accentDeep: "#1b4d9b", // brand-600
  ring: "#7cb0ff", // brand-300
} as const;

/**
 * Single quotes, not double. These stacks are interpolated into `style="..."`
 * attributes, and a double quote inside one closes the attribute early — which
 * silently drops every declaration after the font, colour and all.
 */
const FONT_AR = `'Segoe UI', Tahoma, 'Geeza Pro', Arial, sans-serif`;
const FONT_EN = `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif`;

const COPY = {
  ar: {
    tagline: "كل حساباتك وأعمالك في رابط واحد",
    why: "وصلتك هذه الرسالة لأن لديك حسابًا في ديزاينكم.",
    fallback: "إن لم يعمل الزر، انسخ هذا الرابط إلى متصفحك:",
    support: "للمساعدة",
  },
  en: {
    tagline: "Everything you do, in one link",
    why: "You're receiving this because you have a Designakum account.",
    fallback: "If the button doesn't work, copy this link into your browser:",
    support: "Need help",
  },
} as const;

/* --------------------------------------------------------------------- text */

/**
 * A call to action becomes a labelled bare URL, because a plain-text reader has
 * nothing to click but the address itself.
 */
export function toText(blocks: Block[]): string {
  const out: string[] = [];
  for (const block of blocks) {
    switch (block.type) {
      case "h":
        out.push(block.text, "");
        break;
      case "p":
      case "note":
        out.push(block.text, "");
        break;
      case "cta":
        out.push(`${block.label}:`, block.url, "");
        break;
      case "code":
        out.push(`${block.label}: ${block.value}`, "");
        break;
      case "link":
        out.push(`${block.label}:`, block.url, "");
        break;
      case "facts":
        out.push(...block.rows.map(([label, value]) => `${label}: ${value}`), "");
        break;
    }
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

/* --------------------------------------------------------------------- html */

const esc = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

export interface RenderOptions {
  locale: Locale;
  origin: string;
  preheader?: string;
  supportEmail?: string;
  /**
   * Where the wordmark is fetched from. A real send passes a `cid:` reference to
   * the attached copy, which Outlook will draw without asking. The https URL is
   * the default so a preview rendered outside the mailer still shows a logo.
   */
  logoSrc?: string;
}

export function toHtml(blocks: Block[], options: RenderOptions): string {
  const { locale, origin } = options;
  const rtl = locale === "ar";
  const dir = rtl ? "rtl" : "ltr";
  const align = rtl ? "right" : "left";
  const font = rtl ? FONT_AR : FONT_EN;
  const copy = COPY[rtl ? "ar" : "en"];
  const logoSrc = options.logoSrc ?? `${origin}/brand/wordmark-light.png`;

  const base = `margin:0;font-family:${font};text-align:${align};`;

  const parts = blocks.map((block) => {
    switch (block.type) {
      case "h":
        return `<h1 style="${base}font-size:21px;line-height:1.45;font-weight:700;color:${C.bright};padding:0 0 14px;">${esc(block.text)}</h1>`;

      case "p":
        return `<p style="${base}font-size:15px;line-height:1.75;color:${C.body};padding:0 0 14px;">${esc(block.text)}</p>`;

      case "note":
        return `<p style="${base}font-size:13px;line-height:1.7;color:${C.muted};padding:0 0 14px;">${esc(block.text)}</p>`;

      case "code":
        // A code is read off the screen and typed somewhere else, so it is set
        // wide and monospaced: the job is telling 0 from O, not looking pretty.
        return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 20px;"><tr><td dir="${dir}" align="center" bgcolor="${C.well}" style="background-color:${C.well};border:1px solid ${C.line};border-radius:14px;padding:16px 20px;">
<div style="margin:0 0 7px;font-family:${font};font-size:12px;letter-spacing:.04em;color:${C.muted};">${esc(block.label)}</div>
<div style="margin:0;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:24px;letter-spacing:.16em;font-weight:700;color:${C.ring};direction:ltr;">${esc(block.value)}</div>
</td></tr></table>`;

      case "link":
        // A URL is not a table value. Given its own well it survives a 320px
        // phone, where the same address squeezed into a right-aligned column
        // wraps mid-word and reads like a mistake.
        return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:2px 0 18px;"><tr><td dir="${dir}" align="center" bgcolor="${C.well}" style="background-color:${C.well};border:1px solid ${C.line};border-radius:14px;padding:14px 18px;">
<div style="margin:0 0 6px;font-family:${font};font-size:12px;color:${C.muted};">${esc(block.label)}</div>
<a href="${esc(block.url)}" style="font-family:${font};font-size:14px;font-weight:700;color:${C.ring};text-decoration:none;word-break:break-word;direction:ltr;display:inline-block;">${esc(block.url)}</a>
</td></tr></table>`;

      case "facts":
        return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:2px 0 18px;border:1px solid ${C.line};border-radius:14px;background-color:${C.well};">${block.rows
          .map(
            ([label, value], index) =>
              `<tr><td dir="${dir}" align="${align}" style="padding:11px 18px;font-family:${font};font-size:13px;color:${C.muted};${index ? `border-top:1px solid ${C.line};` : ""}">${esc(label)}</td><td dir="${dir}" align="${rtl ? "left" : "right"}" style="padding:11px 18px;font-family:${font};font-size:14px;font-weight:700;color:${C.bright};word-break:break-word;${index ? `border-top:1px solid ${C.line};` : ""}">${esc(value)}</td></tr>`,
          )
          .join("")}</table>`;

      case "cta":
        // Solid background, never a gradient: Outlook renders this through Word,
        // which drops background images and would leave white text on white.
        // The raw URL follows underneath for anyone whose client eats the button.
        return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:6px 0 18px;"><tr><td bgcolor="${C.accent}" style="background-color:${C.accent};border-radius:12px;">
<a href="${esc(block.url)}" style="display:inline-block;padding:14px 30px;font-family:${font};font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:12px;">${esc(block.label)}</a>
</td></tr></table>
<p style="${base}font-size:12px;line-height:1.6;color:${C.muted};padding:0 0 16px;">${esc(copy.fallback)}<br><a href="${esc(block.url)}" style="color:${C.ring};text-decoration:underline;word-break:break-all;">${esc(block.url)}</a></p>`;
    }
  });

  const support = options.supportEmail
    ? `<br>${esc(copy.support)}: <a href="mailto:${esc(options.supportEmail)}" style="color:${C.muted};text-decoration:underline;">${esc(options.supportEmail)}</a>`
    : "";

  // The preheader is the grey line a client shows next to the subject. Left
  // empty it scrapes whatever comes first — usually the alt text of the logo.
  const preheader = options.preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(options.preheader)}</div>`
    : "";

  return `<!doctype html>
<html lang="${locale}" dir="${dir}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark">
<meta name="supported-color-schemes" content="dark">
</head>
<body style="margin:0;padding:0;background-color:${C.page};">
${preheader}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.page}" style="background-color:${C.page};margin:0;padding:0;">
<tr><td align="center" style="padding:30px 16px 40px;">

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;margin:0 auto;">

<tr><td align="center" style="padding:6px 0 24px;">
<a href="${esc(origin)}" style="text-decoration:none;">
<img src="${esc(logoSrc)}" width="150" height="38" alt="Designakum" style="display:block;border:0;width:150px;height:38px;font-family:${font};font-size:17px;font-weight:700;color:${C.bright};text-decoration:none;">
</a>
</td></tr>

<tr><td bgcolor="${C.card}" style="background-color:${C.card};border:1px solid ${C.line};border-radius:20px;padding:30px 28px 18px;">
${parts.join("\n")}
</td></tr>

<tr><td dir="${dir}" align="center" style="padding:22px 12px 0;font-family:${font};font-size:12px;line-height:1.75;color:${C.muted};">
<a href="${esc(origin)}" style="color:${C.muted};text-decoration:none;">designakum.com</a> &nbsp;&middot;&nbsp; ${esc(copy.tagline)}
<br>${esc(copy.why)}${support}
</td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}
