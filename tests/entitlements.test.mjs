import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { contains, db, sessionFor, visit } from "./helpers.mjs";

describe("subscription entitlements", () => {
  test("publishing is what the subscription gates", async () => {
    const connection = db();
    const rows = await connection
      .prepare(
        `SELECT u.email, p.slug, p.published, s.status FROM users u
           JOIN portfolios p ON p.user_id = u.id
           LEFT JOIN subscriptions s ON s.id = (
             SELECT s2.id FROM subscriptions s2 WHERE s2.user_id = u.id
              ORDER BY s2.created_at DESC, s2.seq DESC LIMIT 1)
          WHERE u.role = 'client'`,
      )
      .all();
    connection.close();

    for (const row of rows) {
      const page = await visit(`/p/${row.slug}`);
      const live = row.published === 1 && row.status === "active";

      assert.equal(
        !contains(page, "قيد التجهيز"),
        live,
        `${row.slug}: a page is public only when published AND subscribed`,
      );
    }
  });

  test("a lapsed subscription takes the page off the internet without losing it", async () => {
    const connection = db();
    const sub = await connection
      .prepare(
        `SELECT s.id, u.email, p.slug, p.published FROM subscriptions s
           JOIN users u ON u.id = s.user_id
           JOIN portfolios p ON p.user_id = u.id
          WHERE s.status = 'active' AND p.published = 1 LIMIT 1`,
      )
      .get();
    connection.close();
    assert.ok(sub, "seed should include a published, subscribed portfolio");

    const before = await visit(`/p/${sub.slug}`);
    assert.ok(!contains(before, "قيد التجهيز"), "should start public");

    const lapse = db();
    await lapse.prepare("UPDATE subscriptions SET status = 'expired' WHERE id = ?").run(sub.id);
    lapse.close();

    try {
      const during = await visit(`/p/${sub.slug}`);
      assert.ok(contains(during, "قيد التجهيز"), "a lapsed subscription must hide the page");

      // The customer's own flag and content are untouched — only visibility changed.
      const check = db();
      const still = await check
        .prepare("SELECT published FROM portfolios WHERE slug = ?")
        .get(sub.slug);
      const projects = await check
        .prepare("SELECT COUNT(*)::int AS n FROM projects p JOIN portfolios pf ON pf.id = p.portfolio_id WHERE pf.slug = ?")
        .get(sub.slug);
      check.close();

      assert.equal(still.published, 1, "the published flag must survive a lapse");
      assert.ok(projects.n > 0, "the customer's work must survive a lapse");
    } finally {
      const restore = db();
      await restore.prepare("UPDATE subscriptions SET status = 'active' WHERE id = ?").run(sub.id);
      restore.close();
    }

    const after = await visit(`/p/${sub.slug}`);
    assert.ok(!contains(after, "قيد التجهيز"), "resubscribing must restore the page as it was");
  });

  test("comped subscriptions are excluded from revenue", async () => {
    const connection = db();
    const comped = await connection
      .prepare("SELECT COUNT(*)::int AS n FROM subscriptions WHERE source <> 'paid' AND amount <> 0")
      .get();
    connection.close();

    assert.equal(comped.n, 0, "a granted or invited subscription must bill zero");
  });

  test("the owner console reports the same revenue the data supports", async () => {
    const connection = db();
    const paid = await connection
      .prepare(
        `SELECT s.plan, s.amount FROM subscriptions s
          WHERE s.status = 'active' AND s.source = 'paid'
            AND (s.current_period_end IS NULL OR s.current_period_end > ?)`,
      )
      .all(Date.now());
    connection.close();

    // Number(): pg hands bigint columns back as strings, and `total + row.amount`
    // on a string concatenates. With one paid row that happened to look right.
    const expectedMrr = paid.reduce((total, row) => {
      const amount = Number(row.amount);
      return total + (row.plan === "yearly" ? amount / 12 : amount);
    }, 0);

    const page = await visit("/console/subscriptions", {
      cookie: await sessionFor("admin@designakum.sa"),
    });
    assert.equal(page.status, 200);

    const rendered = (expectedMrr / 100).toLocaleString("en-US", { maximumFractionDigits: 2 });
    assert.ok(
      contains(page, rendered),
      `console should show MRR of ${rendered}`,
    );
  });
});

describe("pricing is settings-driven", () => {
  test("the public page reflects the stored price and recomputes the saving", async () => {
    const connection = db();
    const row = await connection
      .prepare("SELECT value FROM settings WHERE key = 'pricing.monthly_halalas'")
      .get();
    const monthly = row ? Number(JSON.parse(row.value)) : 1200;
    const yearlyRow = await connection
      .prepare("SELECT value FROM settings WHERE key = 'pricing.yearly_halalas'")
      .get();
    const yearly = yearlyRow ? Number(JSON.parse(yearlyRow.value)) : 12000;
    connection.close();

    const page = await visit("/pricing");
    assert.equal(page.status, 200);

    assert.ok(contains(page, String(monthly / 100)), "monthly price should be rendered");
    assert.ok(contains(page, String(yearly / 100)), "yearly price should be rendered");

    const twelve = monthly * 12;
    const percent = (((twelve - yearly) / twelve) * 100).toFixed(1).replace(/\.0$/, "");
    assert.ok(contains(page, `${percent}%`), `saving should be ${percent}%`);
  });
});
