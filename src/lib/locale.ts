import "server-only";
import { cookies, headers } from "next/headers";
import { DEFAULT_LOCALE, LOCALES, isLocale } from "./i18n";
import type { Locale } from "./types";

export const LOCALE_COOKIE = "dk_locale";

/** A year: the choice is made once and should not be asked for again. */
export const LOCALE_COOKIE_MAX_AGE = 365 * 24 * 60 * 60;

/**
 * How the language cookie is written, in one place.
 *
 * Three call sites were spelling these options out separately and had already
 * drifted — none of them marked it Secure. It carries no secret, but a cookie
 * without that flag is still one a plain-HTTP request can set, and the session
 * cookie beside it has always had it.
 */
export const localeCookieOptions = {
  path: "/",
  maxAge: LOCALE_COOKIE_MAX_AGE,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
} as const;

/** The visitor's chosen interface language, remembered in a cookie. */
export async function currentLocale(): Promise<Locale> {
  const value = (await cookies()).get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

/** Whether this visitor has ever chosen. Absence is what triggers the gate. */
export async function hasChosenLocale(): Promise<boolean> {
  return isLocale((await cookies()).get(LOCALE_COOKIE)?.value);
}

/**
 * What to preselect in the gate. The browser's own preference is a good guess
 * and a bad decision — it is offered, not applied, because plenty of people in
 * Riyadh run an English-language OS and still want the Arabic site.
 */
export async function suggestedLocale(): Promise<Locale> {
  const header = (await headers()).get("accept-language") ?? "";
  for (const part of header.split(",")) {
    const tag = part.split(";")[0]?.trim().toLowerCase();
    if (!tag) continue;
    const base = tag.split("-")[0];
    if (LOCALES.includes(base as Locale)) return base as Locale;
  }
  return DEFAULT_LOCALE;
}

/**
 * Surfaces the language gate belongs on: the marketing and account journey, where
 * the visitor is choosing how they will use the platform.
 *
 * Not a public portfolio — `/p/…` is a link someone was sent, it renders in the
 * language its designer chose, and stopping a visitor with a question before they
 * can see the work would cost the designer the visit.
 *
 * Not the dashboard or console either: by then the account's own language decides.
 */
const GATED = ["/", "/pricing", "/signup", "/login", "/forgot"];

export function gateApplies(pathname: string): boolean {
  return GATED.includes(pathname) || pathname.startsWith("/legal");
}

/**
 * Action messages in the caller's language.
 *
 * A server action always runs inside the request that triggered it, so unlike a
 * webhook it can simply read the cookie — no need to hand keys back to the
 * component and translate there.
 */
export async function messages() {
  const { dict } = await import("./i18n");
  return dict(await currentLocale()).messages;
}


/**
 * The language a page is written in, which is not always the reader's.
 *
 * A portfolio belongs to its owner and is written in one language; a visitor
 * arriving with the other preference is still reading that page. The document's
 * own `lang` and `dir` have to say so — a screen reader announcing an English
 * page as Arabic is wrong, and so is telling a search engine the same thing.
 *
 * Only portfolio routes have an answer; everything else is the platform talking
 * to the reader, and that follows the reader. The lookup is React-cached, so the
 * layout and the page it wraps share one query rather than making two.
 */
export async function pageLocale(pathname: string): Promise<Locale | null> {
  const slugMatch = /^\/p\/([^/]+)/.exec(pathname);
  const hostMatch = /^\/sites\/([^/]+)/.exec(pathname);
  if (!slugMatch && !hostMatch) return null;

  const { getPortfolioBySlug } = await import("./portfolios");

  if (slugMatch) {
    const portfolio = await getPortfolioBySlug(decodeURIComponent(slugMatch[1]));
    return portfolio && isLocale(portfolio.locale) ? portfolio.locale : null;
  }

  const { portfolioIdForHost } = await import("./domains");
  const { get } = await import("./db");
  const id = await portfolioIdForHost(decodeURIComponent(hostMatch![1]));
  if (!id) return null;
  const row = await get<{ locale: string }>("SELECT locale FROM portfolios WHERE id = ?", id);
  return row && isLocale(row.locale) ? row.locale : null;
}
