import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

/**
 * Portfolios are the point of the platform, so they are open to crawlers. Every
 * signed-in surface is not: the console, the client dashboard, the API and the
 * one-time links in password-reset mail have no business in a search index.
 */
export default async function robots(): Promise<MetadataRoute.Robots> {
  const origin = await siteUrl();

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/console", "/admin", "/dashboard", "/api/", "/reset/", "/forgot", "/portfolio/"],
      },
    ],
    sitemap: `${origin}/sitemap.xml`,
    host: origin,
  };
}
