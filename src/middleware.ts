import { NextResponse, type NextRequest } from "next/server";

/**
 * A per-request nonce for the Content-Security-Policy.
 *
 * The old policy allowed `'unsafe-inline'` for scripts, which meant the script
 * half of the CSP bought almost nothing: an injected inline `<script>` would
 * have run. It was there because Next writes its bootstrap and RSC payload as
 * inline scripts, and without a nonce there is no way to allow those and refuse
 * everything else.
 *
 * Next reads the nonce out of the CSP on the *request* and stamps it onto the
 * scripts it emits, so this is the piece that was missing. `'strict-dynamic'`
 * then lets the bootstrap load the chunks it needs without listing each one.
 */
const isProduction = process.env.NODE_ENV === "production";

function policy(nonce: string): string {
  return [
    "default-src 'self'",
    // Dev needs eval for React Refresh, and `unsafe-inline` alongside the nonce
    // for the HMR client; a browser that understands nonces ignores
    // `unsafe-inline`, so this is a dev-only relaxation by construction.
    isProduction
      ? `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`
      : `script-src 'self' 'nonce-${nonce}' 'unsafe-inline' 'unsafe-eval'`,
    // Styles stay inline-allowed: Tailwind and Next both emit inline style
    // attributes, and a style injection cannot execute script.
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    // Portfolio images come from this origin; data:/blob: cover the cropper preview.
    "img-src 'self' data: blob:",
    "connect-src 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "object-src 'none'",
    ...(isProduction ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
}

/**
 * Hostnames the platform answers to itself, as the middleware sees them.
 *
 * This duplicates the list in src/lib/domains.ts rather than importing it: the
 * middleware runs on the Edge runtime, and that module reaches the database.
 * Both read the same environment variables, so they cannot disagree about which
 * deployment this is.
 */
function isPlatformHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/:\d+$/, "").replace(/\.$/, "");

  const reserved = [process.env.SITE_URL, process.env.URL, process.env.DEPLOY_URL]
    .map((value) => {
      if (!value) return null;
      try {
        return new URL(value).hostname.toLowerCase();
      } catch {
        return null;
      }
    })
    .filter((value): value is string => Boolean(value))
    .concat("localhost", "designakum.sa", "designakum.com");

  return reserved.some((name) => host === name || host.endsWith(`.${name}`));
}

/**
 * Paths that belong to the platform even on a customer's domain: the scripts,
 * images and tracking calls the portfolio itself needs in order to render.
 */
const SHARED_PREFIXES = ["/_next", "/api", "/brand", "/favicon"];

export function middleware(request: NextRequest) {
  const nonce = crypto.randomUUID().replaceAll("-", "");
  const csp = policy(nonce);

  const headers = new Headers(request.headers);
  headers.set("x-nonce", nonce);
  headers.set("Content-Security-Policy", csp);
  // A server layout cannot see the pathname on its own, and the language gate has
  // to know which surfaces it belongs on.
  headers.set("x-pathname", request.nextUrl.pathname);

  const { pathname } = request.nextUrl;
  const host = request.headers.get("host") ?? "";

  // A request that arrived on a name we do not own is a customer's own domain.
  // The hostname is all the Edge can know — which portfolio it points at is a
  // database question, so it is handed to a Node route to answer.
  if (host && !isPlatformHost(host) && !SHARED_PREFIXES.some((p) => pathname.startsWith(p))) {
    const url = request.nextUrl.clone();
    url.pathname = `/sites/${encodeURIComponent(host.replace(/:\d+$/, "").toLowerCase())}`;
    const rewritten = NextResponse.rewrite(url, { request: { headers } });
    rewritten.headers.set("Content-Security-Policy", csp);
    return rewritten;
  }

  const response = NextResponse.next({ request: { headers } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    /*
     * Every document, and nothing that is already an immutable asset: a CSP on
     * a JavaScript or image response governs nothing, and the middleware would
     * only add latency to it.
     */
    {
      source: "/((?!_next/static|_next/image|favicon.ico).*)",
      missing: [{ type: "header", key: "next-router-prefetch" }],
    },
  ],
};
