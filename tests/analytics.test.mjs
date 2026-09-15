import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { BASE, db, visit } from "./helpers.mjs";

/**
 * The day columns are cut in the reporting timezone. Two different engines do
 * the cutting — Intl in Node, to_char in Postgres — and a chart silently lies
 * if they ever disagree, so this pins them together.
 */
const TZ = process.env.REPORTING_TIMEZONE ?? "Asia/Riyadh";

const dayFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

describe("analytics days", () => {
  test("Postgres and Node cut the day in the same timezone", async () => {
    const instants = [
      Date.UTC(2026, 0, 10, 22, 30), // late evening in Riyadh, next day already
      Date.UTC(2026, 0, 10, 20, 59), // one minute before the Riyadh day rolls
      Date.UTC(2026, 0, 10, 21, 1), // one minute after
      Date.UTC(2026, 5, 30, 12, 0), // midsummer, no DST in Riyadh
      Date.now(),
    ];

    const connection = db();
    const statement = connection.prepare(
      "SELECT to_char(to_timestamp(? / 1000.0) AT TIME ZONE ?::text, 'YYYY-MM-DD') AS day",
    );

    for (const ms of instants) {
      const row = await statement.get(ms, TZ);
      assert.equal(
        row.day,
        dayFormatter.format(new Date(ms)),
        `the two engines disagree about ${new Date(ms).toISOString()}`,
      );
    }
    connection.close();
  });

  test("a Riyadh evening is not filed under the next day", async () => {
    // 23:00 Riyadh on the 10th is 20:00 UTC on the 10th — the UTC cut got this
    // right, which is why the bug only showed after midnight local.
    const evening = Date.UTC(2026, 0, 10, 20, 0);
    assert.equal(dayFormatter.format(new Date(evening)), "2026-01-10");
    // 01:00 Riyadh on the 11th is 22:00 UTC on the 10th — this is the one UTC
    // filed a day early.
    const afterMidnight = Date.UTC(2026, 0, 10, 22, 0);
    assert.equal(dayFormatter.format(new Date(afterMidnight)), "2026-01-11");
  });

  test("aggregate counts arrive as numbers, not bigint strings", async () => {
    const connection = db();
    const row = await connection
      .prepare("SELECT COUNT(*)::int AS value FROM users WHERE role = 'client'")
      .get();
    connection.close();

    assert.equal(typeof row.value, "number", "COUNT must be cast, or the charts add up strings");
    assert.ok(row.value >= 0);
  });
});

describe("bot traffic", () => {
  /**
   * A portfolio of this suite's own. The shared seed portfolios are visited and
   * suspended by other test files running at the same time, and a view counter
   * cannot be asserted on while someone else is moving it.
   */
  async function withProbePortfolio(body) {
    const connection = db();
    // The owner must be someone who may actually publish, or the page is withheld
    // and nothing is counted. A free client is also published = 1.
    const owner = await connection
      .prepare(
        `SELECT s.user_id FROM subscriptions s
          WHERE s.status = 'active'
            AND (s.current_period_end IS NULL OR s.current_period_end > ?)
          ORDER BY s.created_at DESC LIMIT 1`,
      )
      .get(Date.now());
    assert.ok(owner, "the seed should leave at least one subscribed customer");

    const slug = `bot-probe-${Math.random().toString(36).slice(2, 10)}`;
    const id = `pf_${slug}`;
    await connection
      .prepare(
        `INSERT INTO portfolios (id, user_id, slug, name, title, published, created_at, updated_at)
         VALUES (?, ?, ?, 'Probe', 'Probe', 1, ?, ?)`,
      )
      .run(id, owner.user_id, slug, Date.now(), Date.now());

    const views = async () =>
      (await connection.prepare("SELECT views::int AS views FROM portfolios WHERE id = ?").get(id))
        .views;

    try {
      await body({ id, slug, views });
    } finally {
      await connection.prepare("DELETE FROM portfolios WHERE id = ?").run(id);
      connection.close();
    }
  }

  test("a crawler's visit is not counted, a browser's is", async () => {
    await withProbePortfolio(async ({ slug, views }) => {
      const before = await views();

      for (const userAgent of [
        "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
        "WhatsApp/2.23.20.0",
        "facebookexternalhit/1.1",
        "curl/8.4.0",
      ]) {
        const page = await visit(`/p/${slug}`, { userAgent });
        assert.equal(page.status, 200, `${userAgent} should still be served the page`);
      }

      assert.equal(await views(), before, "crawlers must not inflate the count");

      const human = await visit(`/p/${slug}`);
      assert.equal(
        await views(),
        before + 1,
        `a real browser must still be counted (status ${human.status}, ${
          human.body.includes("قيد التجهيز") ? "page was withheld" : "page was served"
        })`,
      );
    });
  });

  test("the tracking endpoint accepts but ignores a bot's ping", async () => {
    await withProbePortfolio(async ({ id }) => {
      const connection = db();
      const clicks = async () =>
        (
          await connection
            .prepare(
              `SELECT COALESCE(SUM(count), 0)::int AS n FROM portfolio_events
                WHERE portfolio_id = ? AND kind = 'whatsapp'`,
            )
            .get(id)
        ).n;

      const before = await clicks();
      const response = await fetch(`${BASE}/api/track`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "user-agent": "Googlebot/2.1" },
        body: JSON.stringify({ portfolioId: id, kind: "whatsapp" }),
      });
      assert.equal(response.status, 204);
      assert.equal(await clicks(), before, "a bot's click must not be recorded");
      connection.close();
    });
  });
});
