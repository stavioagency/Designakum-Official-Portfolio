/**
 * The buttons that ask a visitor to do something.
 *
 * A page used to offer one way to get in touch and it had to be WhatsApp, which
 * is the wrong single answer for a studio that takes briefs by email, a shop
 * whose customers phone, or anyone whose next step is a booking page.
 *
 * Pure and dependency-free so the editor, the public page and the tests all
 * agree on what a stored value turns into.
 */
import { safeUrl } from "./safe-url";

export type ButtonKind = "whatsapp" | "call" | "email" | "link";

export const BUTTON_KINDS: ButtonKind[] = ["whatsapp", "call", "email", "link"];

export const isButtonKind = (value: string): value is ButtonKind =>
  (BUTTON_KINDS as string[]).includes(value);

/**
 * Five, and the limit is real rather than tidy.
 *
 * Every button after the first competes with the one above it, and a column of
 * eight equally weighted buttons is a menu, not a call to action. Five also
 * happens to be what fits above the fold on a phone next to a name and a bio.
 */
export const MAX_BUTTONS = 5;

/** Digits only, so a number written 0500 000 000 or +966-50 still dials. */
const digits = (value: string) => value.replace(/[^\d]/g, "");

/**
 * The href a stored button resolves to, or null when there is nothing usable in
 * it. A button with no link is not rendered at all: a dead button on a page
 * whose whole job is getting in touch is worse than one fewer button.
 */
export function buttonHref(kind: string, value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  if (kind === "whatsapp") {
    // wa.me wants the country code and nothing else, no plus and no zeros in
    // front. A local number without a country code cannot be dialled from
    // abroad, which is most of the point of putting it on the internet.
    const number = digits(trimmed).replace(/^0+/, "");
    return number.length >= 8 ? `https://wa.me/${number}` : null;
  }

  if (kind === "call") {
    // A leading + is kept here, unlike WhatsApp: tel: honours it and it is what
    // makes an international number dial correctly from another country.
    const number = digits(trimmed);
    if (number.length < 6) return null;
    return `tel:${trimmed.trim().startsWith("+") ? "+" : ""}${number}`;
  }

  if (kind === "email") {
    const address = trimmed.replace(/^mailto:/i, "");
    return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(address) ? `mailto:${address}` : null;
  }

  return safeUrl(trimmed);
}

export const isUsableButton = (kind: string, value: string) => buttonHref(kind, value) !== null;
