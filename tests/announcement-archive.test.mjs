import test, { after, describe } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { CONNECTION_STRING, closePool, db } from "./helpers.mjs";

process.env.DATABASE_URL ??= CONNECTION_STRING;

const {
  archiveAnnouncement,
  archiveExpired,
  listAnnouncements,
  liveAnnouncementsFor,
  unarchiveAnnouncement,
} = await import("../src/lib/announcements.ts");

const d = db();
const made = [];
const HOUR = 3600_000;

async function announce({ endsAt = null, title = "Archive test" } = {}) {
  const id = `ann_arch_${randomBytes(5).toString("hex")}`;
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

describe("retiring an announcement", () => {
  /**
   * An announcement is a statement the platform made to its customers. The
   * record of what was said and when is the part worth keeping, and deleting
   * one to tidy a list throws it away.
   */
  test("archiving keeps the row", async () => {
    const id = await announce();
    await archiveAnnouncement(id);

    const row = await d.prepare("SELECT archived_at FROM announcements WHERE id = ?").get(id);
    assert.ok(row, "the announcement must still exist");
    assert.ok(row.archived_at !== null, "and be marked archived");
  });

  test("an archived one never reaches a customer, whatever its dates say", async () => {
    const user = await client();
    const id = await announce({ endsAt: Date.now() + HOUR, title: "Archive test live" });

    const before = (await liveAnnouncementsFor(user.id)).map((a) => a.id);
    assert.ok(before.includes(id), "it should be live to begin with");

    await archiveAnnouncement(id);

    const after = (await liveAnnouncementsFor(user.id)).map((a) => a.id);
    assert.ok(!after.includes(id), "archived means gone from the customer's view");
  });

  test("it moves between the two lists rather than disappearing", async () => {
    const id = await announce();

    assert.ok((await listAnnouncements()).some((a) => a.id === id), "starts in the open list");
    await archiveAnnouncement(id);

    assert.ok(!(await listAnnouncements()).some((a) => a.id === id), "leaves the open list");
    assert.ok((await listAnnouncements(true)).some((a) => a.id === id), "and joins the archive");
  });

  test("restoring puts it back", async () => {
    const id = await announce();
    await archiveAnnouncement(id);
    await unarchiveAnnouncement(id);

    const row = await d.prepare("SELECT archived_at FROM announcements WHERE id = ?").get(id);
    assert.equal(row.archived_at, null);
  });
});

describe("archiving on its own", () => {
  test("one whose run has finished is archived without anyone doing it", async () => {
    const done = await announce({ endsAt: Date.now() - HOUR, title: "Archive test expired" });
    const running = await announce({ endsAt: Date.now() + HOUR, title: "Archive test running" });
    const openEnded = await announce({ endsAt: null, title: "Archive test open ended" });

    await archiveExpired();

    const state = async (id) =>
      (await d.prepare("SELECT archived_at FROM announcements WHERE id = ?").get(id)).archived_at;

    assert.ok((await state(done)) !== null, "a finished run should be archived");
    assert.equal(await state(running), null, "one still running should be left alone");
    assert.equal(await state(openEnded), null, "one with no end runs until someone stops it");
  });
});
