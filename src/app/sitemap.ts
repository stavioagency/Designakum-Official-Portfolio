import type { MetadataRoute } from "next";
import { all } from "@/lib/db";
import { siteUrl } from "@/lib/site";

/**
 * Only genuinely public pages are listed. A portfolio qualifies when it is
 * published, not suspended, and its owner's subscription is live — exactly the
 * test `/p/[slug]` applies before serving it, because a URL that answers "قيد
 * التجهيز" is worse than one that is simply absent.
 *
 * Generated per request rather than cached: it reads the request's host when
 * SITE_URL is unset, and a portfolio going live should appear without waiting
 * for a revalidation window.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = await siteUrl();

  const staticPages: MetadataRoute.Sitemap = [
    { url: origin, changeFrequency: "weekly", priority: 1 },
    { url: `${origin}/pricing`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${origin}/legal/terms`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${origin}/legal/privacy`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${origin}/legal/rules`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${origin}/signup`, changeFrequency: "monthly", priority: 0.5 },
  ];

  const portfolios = await all<{ slug: string; updated_at: number }>(
    `SELECT p.slug, p.updated_at FROM portfolios p
       JOIN users u ON u.id = p.user_id
      WHERE p.published = 1
        AND p.suspended = 0
        AND u.status = 'active'
        AND EXISTS (
          SELECT 1 FROM subscriptions s
           WHERE s.user_id = u.id
             AND s.status = 'active'
             AND (s.current_period_end IS NULL OR s.current_period_end > ?)
        )
      ORDER BY p.updated_at DESC
      LIMIT 40000`,
    Date.now(),
  );

  return [
    ...staticPages,
    ...portfolios.map((portfolio) => ({
      url: `${origin}/p/${portfolio.slug}`,
      lastModified: new Date(portfolio.updated_at),
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
  ];
}
