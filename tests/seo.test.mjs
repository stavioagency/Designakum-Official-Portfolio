import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { contains, db, visit } from "./helpers.mjs";

describe("search engines", () => {
  test("robots.txt keeps crawlers out of every signed-in surface", async () => {
    const robots = await visit("/robots.txt");
    assert.equal(robots.status, 200);

    for (const path of ["/console", "/dashboard", "/api/", "/reset/", "/admin"]) {
      assert.ok(robots.body.includes(`Disallow: ${path}`), `${path} should be disallowed`);
    }
    assert.ok(robots.body.includes("Sitemap:"), "robots.txt should point at the sitemap");
  });

  test("the sitemap lists live portfolios and nothing else", async () => {
    const sitemap = await visit("/sitemap.xml");
    assert.equal(sitemap.status, 200);

    const connection = db();
    const portfolios = await connection
      .prepare(
        `SELECT p.slug,
                (p.published = 1 AND p.suspended = 0 AND u.status = 'active'
                  AND EXISTS (SELECT 1 FROM subscriptions s
                               WHERE s.user_id = u.id AND s.status = 'active'
                                 AND (s.current_period_end IS NULL OR s.current_period_end > ?)))
                  AS live
           FROM portfolios p JOIN users u ON u.id = p.user_id`,
      )
      .all(Date.now());
    connection.close();

    assert.ok(portfolios.length, "the seed should leave portfolios to check");

    for (const portfolio of portfolios) {
      const listed = sitemap.body.includes(`/p/${portfolio.slug}<`);
      assert.equal(
        listed,
        portfolio.live,
        portfolio.live
          ? `/p/${portfolio.slug} is public and should be listed`
          : `/p/${portfolio.slug} is not public and must not be listed`,
      );
    }

    for (const path of ["/console", "/dashboard", "/login"]) {
      assert.ok(!sitemap.body.includes(`${path}<`), `${path} must not be in the sitemap`);
    }
  });

  test("a portfolio that is not public is marked noindex", async () => {
    const connection = db();
    const free = await connection
      .prepare(
        `SELECT p.slug FROM portfolios p JOIN users u ON u.id = p.user_id
          WHERE NOT EXISTS (SELECT 1 FROM subscriptions s
                             WHERE s.user_id = u.id AND s.status = 'active')
          LIMIT 1`,
      )
      .get();
    connection.close();
    assert.ok(free, "the seed should include an unsubscribed client");

    const withheld = await visit(`/p/${free.slug}`);
    assert.ok(contains(withheld, "noindex"), "a withheld page must not invite indexing");
  });

  test("signed-in surfaces are noindex in the markup too", async () => {
    for (const path of ["/login", "/forgot"]) {
      const page = await visit(path);
      assert.ok(contains(page, "noindex"), `${path} should carry a noindex robots tag`);
    }
  });
});
