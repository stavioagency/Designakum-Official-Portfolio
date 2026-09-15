import type { NextConfig } from "next";

const isProduction = process.env.NODE_ENV === "production";

/**
 * The Content-Security-Policy is NOT here: it carries a per-request nonce and so
 * lives in src/middleware.ts. Two CSP headers would both apply, and the
 * intersection of the two is not what either one says.
 */
const SECURITY_HEADERS = [
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
