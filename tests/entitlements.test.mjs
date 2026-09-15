import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { contains, db, sessionFor, visit } from "./helpers.mjs";

describe("subscription entitlements", () => {
  test("a free portfolio carries the platform badge and a paid one does not", async () => {
    const free = await visit("/p/noura");
    const paid = await visit("/p/faisal");

    const connection = db();
    const rows = await connection
      .prepare(
        `SELECT u.email, s.status, s.source FROM users u
           LEFT JOIN subscriptions s ON s.id = (
             SELECT s2.id FROM subscriptions s2 WHERE s2.user_id = u.id
              ORDER BY s2.created_at DESC, s2.seq DESC LIMIT 1)
          WHERE u.email IN ('noura@designakum.sa','faisal@designakum.sa')`,
      )
      .all();
    connection.close();

    const subscribed = Object.fromEntries(rows.map((r) => [r.email, r.status === "active"]));

    assert.equal(
      contains(free, "أُنشئت عبر ديزاينكم"),
      !subscribed["noura@designakum.sa"],
      "the badge should appear exactly when there is no active subscription",
    );
    assert.equal(
      contains(paid, "أُنشئت عبر ديزاينكم"),
      !subscribed["faisal@designakum.sa"],
    );
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

    const expectedMrr = paid.reduce(
      (total, row) => total + (row.plan === "yearly" ? row.amount / 12 : row.amount),
      0,
    );

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
