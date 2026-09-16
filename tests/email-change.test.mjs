import test, { after, describe } from "node:test";
import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { BASE, closePool, db, visit } from "./helpers.mjs";

const d = db();
const now = () => Date.now();

async function anyUser() {
  return await d.prepare("SELECT * FROM users ORDER BY created_at LIMIT 1").get();
}

/** Parks a pending change exactly as the app does, and hands back the raw token. */
async function pending(userId, newEmail, { ttl = 30 * 60 * 1000 } = {}) {
  const token = randomBytes(32).toString("base64url");
  const hash = createHash("sha256").update(token).digest("hex");
  const id = `ecg_test_${randomBytes(6).toString("hex")}`;
  await d
    .prepare(
      `INSERT INTO email_changes (id, user_id, new_email, token_hash, expires_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(id, userId, newEmail, hash, now() + ttl, now());
  return { id, token };
}

const cleanup = async (id) => await d.prepare("DELETE FROM email_changes WHERE id = ?").run(id);

after(async () => {
  await d.prepare("DELETE FROM email_changes WHERE id LIKE 'ecg_test_%'").run();
  await closePool();
});

describe("confirming a new address", () => {
  /**
   * The link arrives by email, and mail providers follow links in messages to
   * scan them. If opening the page were enough to adopt the address, Outlook
   * would confirm the change before the customer ever read the message.
   */
  test("opening the link does not change anything on its own", async () => {
    const user = await anyUser();
    const target = `test-prefetch-${Date.now()}@example.com`;
    const { id, token } = await pending(user.id, target);

    const page = await visit(`/email/${token}`);
    assert.equal(page.status, 200, "the confirmation page should render");

    const after = await d.prepare("SELECT email FROM users WHERE id = ?").get(user.id);
    assert.equal(after.email, user.email, "a GET must not adopt the address");

    const row = await d.prepare("SELECT used_at FROM email_changes WHERE id = ?").get(id);
    assert.equal(row.used_at, null, "a GET must not consume the token");

    await cleanup(id);
  });

  test("the pending address is shown so the reader can check it", async () => {
    const user = await anyUser();
    const target = `test-shown-${Date.now()}@example.com`;
    const { id, token } = await pending(user.id, target);

    const page = await visit(`/email/${token}`);
    assert.ok(page.body.includes(target), "the address being confirmed should be on the page");

    await cleanup(id);
  });

  /**
   * Asserted on the confirm form rather than on the address being absent from
   * the response. In development Next serialises awaited server values into the
   * payload for its debugger, so the string is present in the dev response even
   * though the page never renders it — a production build shows neither. The
   * form is the thing that decides whether the address can actually be adopted.
   */
  test("an expired token offers nothing to confirm", async () => {
    const user = await anyUser();
    const { id, token } = await pending(user.id, `test-expired-${Date.now()}@example.com`, {
      ttl: -1000,
    });

    const page = await visit(`/email/${token}`);
    assert.equal(page.status, 200);
    assert.ok(!page.body.includes('name="token"'), "an expired token must not render the form");

    await cleanup(id);
  });

  test("a token that was already used offers nothing to confirm", async () => {
    const user = await anyUser();
    const { id, token } = await pending(user.id, `test-used-${Date.now()}@example.com`);
    await d.prepare("UPDATE email_changes SET used_at = ? WHERE id = ?").run(now(), id);

    const page = await visit(`/email/${token}`);
    assert.ok(!page.body.includes('name="token"'), "a spent token must not render the form");

    await cleanup(id);
  });

  test("a made-up token is refused rather than erroring", async () => {
    const page = await visit(`/email/${randomBytes(32).toString("base64url")}`);
    assert.equal(page.status, 200, "an unknown token should render the dead-link page, not a 500");
  });

  test("the page is kept out of search results", async () => {
    const user = await anyUser();
    const { id, token } = await pending(user.id, `test-robots-${Date.now()}@example.com`);

    const page = await visit(`/email/${token}`);
    assert.match(
      page.body,
      /noindex/i,
      "a page carrying a single-use token must not be indexable",
    );

    await cleanup(id);
  });
});

describe("the token itself", () => {
  test("only its hash is stored, so a leaked row cannot be replayed", async () => {
    const user = await anyUser();
    const target = `test-hash-${Date.now()}@example.com`;
    const { id, token } = await pending(user.id, target);

    const row = await d.prepare("SELECT token_hash FROM email_changes WHERE id = ?").get(id);
    assert.notEqual(row.token_hash, token, "the raw token must not be in the table");
    assert.equal(row.token_hash, createHash("sha256").update(token).digest("hex"));

    await cleanup(id);
  });
});
