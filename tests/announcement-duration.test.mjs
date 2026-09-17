import test, { after, describe } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { CONNECTION_STRING, closePool, db } from "./helpers.mjs";

process.env.DATABASE_URL ??= CONNECTION_STRING;

const { ANNOUNCEMENT_HOURS, endsAtFromHours, liveAnnouncementsFor, announcementHistoryFor } =
  await import("../src/lib/announcements.ts");

const d = db();
const made = [];
const HOUR = 60 * 60 * 1000;

async function announce({ endsAt, title = "Test notice" }) {
  const id = `ann_test_${randomBytes(5).toString("hex")}`;
  made.push(id);
  const ts = Date.now();
  await d
    .prepare(
      `INSERT INTO announcements (id, title, body, severity, active, starts_at, ends_at, created_at, updated_at)
       VALUES (?, ?, '', 'info', 1, ?, ?, ?, ?)`,
    )
    .run(id, title, ts - HOUR, endsAt, ts, ts);
  return id;
}

const client = async () =>
  await d.prepare("SELECT id FROM users WHERE role = 'client' ORDER BY created_at LIMIT 1").get();

after(async () => {
  for (const id of made) {
    await d.prepare("DELETE FROM announcement_reads WHERE announcement_id = ?").run(id);
    await d.prepare("DELETE FROM announcements WHERE id = ?").run(id);
  }
  await closePool();
});

describe("how long an announcement stays up", () => {
  test("an hour is expressible, which a date picker cannot do", () => {
    const from = Date.now();
    assert.equal(endsAtFromHours(1, from) - from, HOUR);
    assert.ok(ANNOUNCEMENT_HOURS.includes(1));
  });

  test("thirty days is the longest, and longer is clamped rather than refused", () => {
    const from = Date.now();
    assert.equal(endsAtFromHours(720, from) - from, 720 * HOUR);
    assert.equal(endsAtFromHours(99999, from) - from, 720 * HOUR);
  });

  test("zero means it runs until it is turned off by hand", () => {
    assert.equal(endsAtFromHours(0, Date.now()), null);
    assert.equal(endsAtFromHours(NaN, Date.now()), null);
  });

  test("an expired announcement stops being shown without anyone touching it", async () => {
    const user = await client();
    const live = await announce({ endsAt: Date.now() + HOUR });
    const done = await announce({ endsAt: Date.now() - HOUR });

    const shown = (await liveAnnouncementsFor(user.id)).map((a) => a.id);
    assert.ok(shown.includes(live), "one still inside its window should show");
    assert.ok(!shown.includes(done), "one past its end should not");
  });
});

describe("the notifications hub", () => {
  test("keeps an announcement after it is dismissed, where the banner drops it", async () => {
    const user = await client();
    const id = await announce({ endsAt: Date.now() + HOUR, title: "Test dismissed notice" });

    await d
      .prepare(
        "INSERT INTO announcement_reads (announcement_id, user_id, created_at) VALUES (?, ?, ?) ON CONFLICT DO NOTHING",
      )
      .run(id, user.id, Date.now());

    const banner = (await liveAnnouncementsFor(user.id)).map((a) => a.id);
    const hub = await announcementHistoryFor(user.id);

    assert.ok(!banner.includes(id), "the banner should drop a dismissed notice");
    const kept = hub.find((a) => a.id === id);
    assert.ok(kept, "the hub should keep it");
    assert.ok(kept.read_at !== null, "and mark it as seen");
  });

  test("an unread notice is distinguishable from a seen one", async () => {
    const user = await client();
    const unread = await announce({ endsAt: Date.now() + HOUR, title: "Test unread notice" });

    const hub = await announcementHistoryFor(user.id);
    const row = hub.find((a) => a.id === unread);
    assert.ok(row, "a live notice should be in the hub");
    assert.equal(row.read_at, null, "and count as unread");
  });
});
