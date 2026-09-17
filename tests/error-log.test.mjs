import test, { after, describe } from "node:test";
import assert from "node:assert/strict";
import { CONNECTION_STRING, closePool, db } from "./helpers.mjs";

process.env.DATABASE_URL ??= CONNECTION_STRING;

const { fingerprint, listErrors, openErrorCount, recordError, resolveError } = await import(
  "../src/lib/error-log.ts"
);

const d = db();
const AREA = "test-area-errors";

const clean = async () =>
  await d.prepare("DELETE FROM error_events WHERE area = ?").run(AREA);

after(async () => {
  await clean();
  await closePool();
});

describe("grouping failures", () => {
  /**
   * The same fault firing a thousand times is one problem. A table that grows a
   * row per request during an outage is a second problem arriving on top of the
   * first.
   */
  test("the same fault is one row with a count, not a thousand rows", async () => {
    await clean();

    for (let i = 0; i < 5; i++) {
      await recordError({ area: AREA, message: "the database went away" });
    }

    const rows = await d.prepare("SELECT * FROM error_events WHERE area = ?").all(AREA);
    assert.equal(rows.length, 1, "five occurrences, one row");
    assert.equal(Number(rows[0].count), 5);
  });

  test("ids and addresses inside a message do not split it into separate faults", () => {
    const a = fingerprint("x", "user usr_abc123def not found");
    const b = fingerprint("x", "user usr_999888777 not found");
    assert.equal(a, b, "the same fault reached with different ids is one fault");

    const c = fingerprint("x", "could not email someone@example.com");
    const e = fingerprint("x", "could not email other@example.com");
    assert.equal(c, e);
  });

  test("genuinely different failures stay apart", () => {
    assert.notEqual(fingerprint("mailer", "boom"), fingerprint("billing", "boom"));
    assert.notEqual(fingerprint("mailer", "boom"), fingerprint("mailer", "different"));
  });
});

describe("deciding whether to wake somebody", () => {
  test("the first occurrence is worth a message and the next ones are not", async () => {
    await clean();

    const first = await recordError({ area: AREA, message: "first shout" });
    assert.equal(first.shouldNotify, true, "the first time is news");

    await d
      .prepare("UPDATE error_events SET notified_at = ? WHERE fingerprint = ?")
      .run(Date.now(), first.fingerprint);

    const second = await recordError({ area: AREA, message: "first shout" });
    assert.equal(second.shouldNotify, false, "the same fault again within the hour is not");
  });

  test("a fault that returns after being resolved is news again", async () => {
    await clean();

    const first = await recordError({ area: AREA, message: "it came back" });
    await d
      .prepare("UPDATE error_events SET notified_at = ? WHERE fingerprint = ?")
      .run(Date.now(), first.fingerprint);
    await resolveError(first.fingerprint);

    const again = await recordError({ area: AREA, message: "it came back" });
    assert.equal(again.shouldNotify, true, "a regression is news whatever the clock says");

    const row = await d
      .prepare("SELECT resolved_at FROM error_events WHERE fingerprint = ?")
      .get(first.fingerprint);
    assert.equal(row.resolved_at, null, "and it is open again");
  });
});

describe("what the console sees", () => {
  test("resolved failures leave the open list and the count", async () => {
    await clean();

    const one = await recordError({ area: AREA, message: "open one" });
    await recordError({ area: AREA, message: "open two" });

    const before = await openErrorCount();
    await resolveError(one.fingerprint);
    const after = await openErrorCount();

    assert.equal(after, before - 1);

    const open = (await listErrors()).filter((e) => e.area === AREA).map((e) => e.message);
    assert.ok(!open.includes("open one"));
    assert.ok(open.includes("open two"));
  });

  /**
   * This runs when something has already gone wrong. If it can throw, it turns
   * one failure into two, and the second one has no way of being reported.
   */
  test("a malformed report is swallowed rather than thrown", async () => {
    const result = await recordError({
      area: "x".repeat(500),
      message: "y".repeat(5000),
      stack: "z".repeat(20000),
      context: { nested: { deep: "value" } },
    });
    assert.ok(result === null || typeof result.fingerprint === "string");
  });
});
