import test, { after, describe } from "node:test";
import assert from "node:assert/strict";
import { closePool, db, visit } from "./helpers.mjs";

const d = db();

async function subject() {
  const row = await d
    .prepare(
      `SELECT p.id, p.slug, p.locale FROM portfolios p
         JOIN users u ON u.id = p.user_id
        WHERE u.role = 'client' AND p.published = 1
        ORDER BY p.created_at LIMIT 1`,
    )
    .get();
  assert.ok(row, "a published customer portfolio is needed");
  return row;
}

const restore = async (p) =>
  await d.prepare("UPDATE portfolios SET locale = ? WHERE id = ?").run(p.locale, p.id);

after(async () => await closePool());

/**
 * A page is written in one language. The owner's own reading language is a
 * separate thing — an Arabic designer may want an English page — and until the
 * page language became editable, whichever was chosen at sign-up was permanent.
 */
describe("a portfolio's own language", () => {
  /**
   * Restored in a finally, not after the assertions. An earlier version put the
   * restore last, so the first failure left the fixture in the other language
   * and took an unrelated test down with it on the next run.
   */
  test("an English page reads English however the visitor arrives", async () => {
    const p = await subject();
    try {
      await d.prepare("UPDATE portfolios SET locale = 'en' WHERE id = ?").run(p.id);

      // Visitor whose own preference is Arabic: the page is still the owner's.
      const page = await visit(`/p/${p.slug}`, { locale: "ar" });
      assert.match(page.body, /<html[^>]*lang="en"/, "the document language follows the page");
      assert.match(page.body, /dir="ltr"/, "and so does its direction");
    } finally {
      await restore(p);
    }
  });

  test("an Arabic page reads Arabic to an English-preferring visitor", async () => {
    const p = await subject();
    try {
      await d.prepare("UPDATE portfolios SET locale = 'ar' WHERE id = ?").run(p.id);

      const page = await visit(`/p/${p.slug}`, { locale: "en" });
      assert.match(page.body, /dir="rtl"/, "an Arabic page stays right to left");
    } finally {
      await restore(p);
    }
  });

  test("changing it does not touch anything the owner wrote", async () => {
    const p = await subject();
    const before = await d
      .prepare("SELECT name, title, bio FROM portfolios WHERE id = ?")
      .get(p.id);

    try {
      await d.prepare("UPDATE portfolios SET locale = 'en' WHERE id = ?").run(p.id);
      const after = await d.prepare("SELECT name, title, bio FROM portfolios WHERE id = ?").get(p.id);
      assert.deepEqual(after, before, "the language is presentation, not content");
    } finally {
      await restore(p);
    }
  });
});
