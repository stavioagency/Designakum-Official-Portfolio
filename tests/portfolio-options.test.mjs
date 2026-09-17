import test, { after, describe } from "node:test";
import assert from "node:assert/strict";
import { closePool, db, sessionFor, visit } from "./helpers.mjs";

const d = db();

/** The first portfolio whose owner is a real customer, restored after each test. */
async function subject() {
  const row = await d
    .prepare(
      `SELECT p.id, p.slug, p.works_label, p.hide_branding, p.user_id
         FROM portfolios p JOIN users u ON u.id = p.user_id
        WHERE u.role = 'client' AND p.published = 1
        ORDER BY p.created_at LIMIT 1`,
    )
    .get();
  assert.ok(row, "a published customer portfolio is needed for these");
  return row;
}

const restore = async (p) =>
  await d
    .prepare("UPDATE portfolios SET works_label = ?, hide_branding = ? WHERE id = ?")
    .run(p.works_label, p.hide_branding, p.id);

after(async () => await closePool());

describe("naming the works section", () => {
  test("the owner's own word replaces the default", async () => {
    const p = await subject();
    await d.prepare("UPDATE portfolios SET works_label = ? WHERE id = ?").run("الفروع", p.id);

    const page = await visit(`/p/${p.slug}`);
    assert.ok(page.body.includes("الفروع"), "the chosen name should be on the page");

    await restore(p);
  });

  /**
   * The page's language, not the reader's. A portfolio is written in one
   * language and a visitor arriving with the other preference is still reading
   * that page — the section's default name has to come from the same place
   * every other word on it does.
   */
  test("an empty name falls back to the platform's word in the page's language", async () => {
    const p = await subject();
    const row = await d.prepare("SELECT locale FROM portfolios WHERE id = ?").get(p.id);
    const expected = row.locale === "en" ? "Selected work" : "أعمالي";

    try {
      await d.prepare("UPDATE portfolios SET works_label = '' WHERE id = ?").run(p.id);
      const page = await visit(`/p/${p.slug}`, { locale: row.locale === "en" ? "ar" : "en" });
      assert.ok(page.body.includes(expected), `expected the ${row.locale} default: ${expected}`);
    } finally {
      await restore(p);
    }
  });
});

/**
 * The control is hidden from customers without a plan, but hiding a control is
 * not enforcement. What matters is that the page itself refuses to honour the
 * preference unless the subscription is live, which is what these check.
 */
describe("hiding the platform's signature", () => {
  test("a subscribed customer who asks for it gets it", async () => {
    const p = await subject();
    await d.prepare("UPDATE portfolios SET hide_branding = 1 WHERE id = ?").run(p.id);

    const page = await visit(`/p/${p.slug}`);
    const strip = page.body.replace(/<script[\s\S]*?<\/script>/gi, "");
    assert.ok(!strip.includes("صُنع على"), "the line should be gone for a subscriber");

    await restore(p);
  });

  /**
   * Checked through the owner's own view, because a lapsed subscription also
   * takes the page off the public internet — so the visitor's copy is not where
   * the rule is observable. The owner still sees their page, and what they see
   * is the line back again while their stored preference is untouched.
   */
  test("a lapse brings the line back without discarding what they asked for", async () => {
    const p = await subject();
    await d.prepare("UPDATE portfolios SET hide_branding = 1 WHERE id = ?").run(p.id);

    const owner = await d.prepare("SELECT email FROM users WHERE id = ?").get(p.user_id);
    const cookie = await sessionFor(owner.email);

    const subs = await d
      .prepare("SELECT id, status FROM subscriptions WHERE user_id = ? AND status = 'active'")
      .all(p.user_id);

    try {
      const subscribed = await visit(`/p/${p.slug}`, { cookie, locale: "ar" });
      assert.ok(
        !subscribed.body.replace(/<script[\s\S]*?<\/script>/gi, "").includes("صُنعت على"),
        "while subscribed the line should be hidden",
      );

      for (const s of subs) {
        await d.prepare("UPDATE subscriptions SET status = 'expired' WHERE id = ?").run(s.id);
      }

      const lapsed = await visit(`/p/${p.slug}`, { cookie, locale: "ar" });
      assert.ok(
        lapsed.body.includes("صُنعت على"),
        "once the plan lapses the line must come back",
      );

      const stored = await d.prepare("SELECT hide_branding FROM portfolios WHERE id = ?").get(p.id);
      assert.equal(Number(stored.hide_branding), 1, "their preference must be kept, not reset");
    } finally {
      for (const s of subs) {
        await d.prepare("UPDATE subscriptions SET status = ? WHERE id = ?").run(s.status, s.id);
      }
      await restore(p);
    }
  });
});
