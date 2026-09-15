/**
 * Everything a customer or a reporter types eventually lands in an `href`, and an
 * `href` is executable: `javascript:` and `data:` URLs run script in the visitor's
 * page. So stored links pass through here on the way in (rejected at save time)
 * and on the way out (rendered as plain text if anything slipped through before
 * this existed).
 */
const ALLOWED_PROTOCOLS = new Set(["http:", "https:", "mailto:", "tel:"]);

export function safeUrl(input: string | null | undefined): string | null {
  if (!input) return null;

  const trimmed = input.trim();
  if (!trimmed) return null;

  // A bare domain is the common case in a form field; assume https rather than
  // letting the browser resolve it as a relative path.
  const candidate = /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`;

  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return null;
  }

  if (!ALLOWED_PROTOCOLS.has(url.protocol)) return null;
  return url.toString();
}

export const isSafeUrl = (input: string | null | undefined) => safeUrl(input) !== null;

/** Turns a bare handle or address into a link for the platform it belongs to. */
export function socialHref(platform: string, value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  if (platform === "email") {
    if (trimmed.startsWith("mailto:")) return safeUrl(trimmed);
    return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(trimmed) ? `mailto:${trimmed}` : null;
  }

  return safeUrl(trimmed);
}
