import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { db, sessionFor, visit } from "./helpers.mjs";

/**
 * These console lists used to select every row. The failure mode is not a crash
 * on day one — it is a page that gets slower every month until it times out, on
 * exactly the platform that is doing well enough to have the rows.
 */
describe("console lists are paged", () => {
  const PROBE = "ZZTEST";

  async function withInvitations(count, body) {
    const connection = db();
    const created = [];
    for (let i = 0; i < count; i++) {
      const code = `${PROBE}-${String(i).padStart(3, "0")}`;
      await connection
        .prepare(
          `INSERT INTO invitations (id, code, plan, months, max_uses, note, created_at)
           VALUES (?, ?, 'monthly', 1, 1, 'pagination probe', ?)`,
        )
        // Newest first, so a descending sort puts the highest index on page one.
        .run(`inv_${code}`, code, Date.now() + i * 1000);
      created.push(code);
    }
    connection.close();

    try {
      await body(created);
    } finally {
      const cleanup = db();
      await cleanup.prepare("DELETE FROM invitations WHERE code LIKE ?").run(`${PROBE}-%`);
      cleanup.close();
    }
  }

  test("invitations page two shows different codes from page one", async () => {
    await withInvitations(30, async (codes) => {
      const cookie = await sessionFor("admin@designakum.sa");

      const first = await visit("/console/invitations", { cookie });
      const second = await visit("/console/invitations?page=2", { cookie });
      assert.equal(first.status, 200);
      assert.equal(second.status, 200);

      const newest = codes.at(-1);
      const oldest = codes[0];

      assert.ok(first.body.includes(newest), "the newest code belongs on page one");
      assert.ok(!first.body.includes(oldest), "page one must not carry the whole table");
      assert.ok(second.body.includes(oldest), "the oldest code belongs on a later page");

      const onFirst = codes.filter((code) => first.body.includes(code));
      assert.ok(onFirst.length <= 25, `page one showed ${onFirst.length} probe rows, expected ≤ 25`);
    });
  });

  test("the subscriptions list is paged rather than silently truncated", async () => {
    const cookie = await sessionFor("admin@designakum.sa");
    const page = await visit("/console/subscriptions?status=all", { cookie });
    assert.equal(page.status, 200);
    assert.ok(
      !page.body.includes("أحدث 100 اشتراك"),
      "the list should report its real total, not a fixed cap",
    );
  });
});
