import type { NextConfig } from "next";

const isProduction = process.env.NODE_ENV === "production";

/**
 * Defence in depth behind the input sanitising, not instead of it.
 *
 * `unsafe-inline` for scripts is still required: Next inlines its bootstrap and
 * RSC payload without a nonce unless a middleware generates one per request.
 * Tightening that to nonces is tracked in LAUNCH.md as a follow-up.
 */
const CSP = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isProduction ? "" : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  // Portfolio images are served from this origin; data:/blob: cover the cropper preview.
  "img-src 'self' data: blob:",
  "connect-src 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'",
  ...(isProduction ? ["upgrade-insecure-requests"] : []),
].join("; ");

const SECURITY_HEADERS = [
  { key: "Content-Security-Policy", value: CSP },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
  ...(isProduction
    ? [
        {
          key: "Strict-Transport-Security",
          value: "max-age=63072000; includeSubDomains; preload",
        },
      ]
    : []),
];

const nextConfig: NextConfig = {
  // A build and `next dev` sharing one output directory corrupt each other's
  // chunks. `npm run build` sets NEXT_DIST_DIR so both can run at once.
  distDir: process.env.NEXT_DIST_DIR ?? ".next",

  experimental: {
    // Vercel caps a serverless request body at 4.5 MB, so anything larger here
    // would be rejected by the platform before the action ever runs.
    serverActions: { bodySizeLimit: "4mb" },
  },

  poweredByHeader: false,

  async headers() {
    return [
      { source: "/:path*", headers: SECURITY_HEADERS },
      {
        // The console must never be indexed, whatever a crawler tries.
        source: "/console/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" }],
      },
    ];
  },
};

export default nextConfig;
