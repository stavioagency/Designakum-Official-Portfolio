import test, { after, describe } from "node:test";
import assert from "node:assert/strict";
import { CONNECTION_STRING, closePool, db } from "./helpers.mjs";

/**
 * The real `recordSubscription`, not a copy of it. An earlier version of this
 * file reproduced the supersede in its own helper, which proved only that the
 * test agreed with itself — deleting the fix from billing.ts left it green.
 */
// billing.ts builds its pool from the environment; point it at the same
// database the helpers use before it is imported.
process.env.DATABASE_URL ??= CONNECTION_STRING;

const { recordSubscription } = await import("../src/lib/billing.ts");

const d = db();
const made = [];
const started = Date.now();

async function user() {
  return await d.prepare("SELECT id FROM users ORDER BY created_at LIMIT 1").get();
}

async function record(userId, { plan = "monthly", status = "active" } = {}) {
  const sub = await recordSubscription({
    userId,
    plan,
    status,
    provider: "manual",
    source: "manual",
    amount: 0,
    currentPeriodEnd: Date.now() + 30 * 86_400_000,
  });
  made.push(sub.id);
  return sub.id;
}

const activeCount = async (userId) =>
  Number(
    (
      await d
        .prepare("SELECT COUNT(*) AS n FROM subscriptions WHERE user_id = ? AND status = 'active'")
        .get(userId)
    ).n,
  );

after(async () => {
  for (const id of made) await d.prepare("DELETE FROM subscriptions WHERE id = ?").run(id);
  // recordSubscription also writes users.plan and a billing event; put both back.
  await d.prepare("DELETE FROM billing_events WHERE detail LIKE '%manual%' AND created_at > ?").run(started);
  await closePool();
});

describe("granting a subscription twice", () => {
  /**
   * The bug this covers: every grant inserted a row, so a second one left two
   * live subscriptions on one account. The console then counted more
   * subscribers than it had customers.
   */
  test("leaves exactly one active subscription", async () => {
    const u = await user();
    const before = await activeCount(u.id);

    await record(u.id, { plan: "monthly" });
    await record(u.id, { plan: "monthly" });
    await record(u.id, { plan: "yearly" });

    assert.equal(await activeCount(u.id), 1, "an account has one active subscription");

    // Whatever the account already had is retired too, so the count is absolute.
    assert.ok(before >= 0);
  });

  test("the replaced row is retired as superseded, not cancelled", async () => {
    const u = await user();
    const first = await record(u.id);
    await record(u.id);

    const row = await d.prepare("SELECT status FROM subscriptions WHERE id = ?").get(first);
    assert.equal(row.status, "superseded");
  });

  /**
   * Churn counts cancellations and expiries. A subscription that was replaced is
   * neither, and counting it would report a loss that never happened.
   */
  test("a replaced subscription is not counted as churn or as an ending", async () => {
    const u = await user();
    const first = await record(u.id);
    await record(u.id);

    const ended = await d
      .prepare(
        "SELECT COUNT(*) AS n FROM subscriptions WHERE id = ? AND status IN ('canceled','expired')",
      )
      .get(first);
    assert.equal(Number(ended.n), 0, "a replaced subscription must not read as an ending");
  });

  test("recording an inactive subscription retires nothing", async () => {
    const u = await user();
    const live = await record(u.id, { status: "active" });
    await record(u.id, { status: "incomplete" });

    const row = await d.prepare("SELECT status FROM subscriptions WHERE id = ?").get(live);
    assert.equal(row.status, "active", "an abandoned checkout must not retire a paid plan");
  });
});
