import "server-only";
import { headers } from "next/headers";

/**
 * The platform's canonical origin, used for anything that has to name itself
 * from the outside: robots.txt, the sitemap, OAuth redirects and links in email.
 *
 * `SITE_URL` is authoritative. Without it we fall back to the request's own host,
 * which is right in development and on a preview deployment, and would only be
 * wrong in production if the variable were left unset — which the launch
 * checklist covers.
 */
const configured = (process.env.SITE_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? "").trim();

export function configuredSiteUrl(): string | null {
  if (!configured) return null;
  try {
    return new URL(configured).origin;
  } catch {
    return null;
  }
}

export async function siteUrl(): Promise<string> {
  const fixed = configuredSiteUrl();
  if (fixed) return fixed;

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

/** Absolute URL for a path on this platform. */
export async function absoluteUrl(pathname: string): Promise<string> {
  return new URL(pathname, await siteUrl()).toString();
}
