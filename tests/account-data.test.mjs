import test, { after, describe } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { CONNECTION_STRING, closePool, db } from "./helpers.mjs";

process.env.DATABASE_URL ??= CONNECTION_STRING;
process.env.SITE_URL ??= "http://localhost:3000";

const { exportAccount, deleteAccount, accountRemnants } = await import(
  "../src/lib/account-data.ts"
);

const d = db();
const made = [];
const ts = () => Date.now();

/** A throwaway account with something in every table a deletion has to reach. */
async function buildAccount() {
  const id = `usr_test_${randomBytes(6).toString("hex")}`;
  const email = `${id}@example.test`;
  made.push({ id, email });

  await d
    .prepare(
      `INSERT INTO users (id, email, password_hash, display_name, role, status, locale, created_at, updated_at)
       VALUES (?, ?, 'scrypt$fake', 'Test Person', 'client', 'active', 'ar', ?, ?)`,
    )
    .run(id, email, ts(), ts());

  const portfolioId = `pf_test_${randomBytes(5).toString("hex")}`;
  await d
    .prepare(
      `INSERT INTO portfolios (id, user_id, slug, name, title, created_at, updated_at)
       VALUES (?, ?, ?, 'Test Person', 'Designer', ?, ?)`,
    )
    .run(portfolioId, id, `test-${randomBytes(4).toString("hex")}`, ts(), ts());

  await d
    .prepare(
      `INSERT INTO projects (id, portfolio_id, title, description, position)
       VALUES (?, ?, 'A project', 'Its description', 0)`,
    )
    .run(`prj_test_${randomBytes(5).toString("hex")}`, portfolioId);

  await d
    .prepare(
      `INSERT INTO assets (id, owner_id, mime, bytes, storage_path, byte_size, created_at)
       VALUES (?, ?, 'image/png', ''::bytea, ?, 10, ?)`,
    )
    .run(`ast_test_${randomBytes(5).toString("hex")}`, id, `test/${id}.png`, ts());

  await d
    .prepare(
      `INSERT INTO mail_outbox (id, recipient, subject, body, kind, delivered, error, created_at)
       VALUES (?, ?, 'Welcome', 'body', 'welcome', 1, '', ?)`,
    )
    .run(`mail_test_${randomBytes(5).toString("hex")}`, email, ts());

  await d
    .prepare(
      `INSERT INTO audit_log (id, actor_id, actor_email, actor_role, action, target_type, target_id, target_label, detail, created_at)
       VALUES (?, ?, ?, 'client', 'test.action', 'user', ?, ?, '', ?)`,
    )
    .run(`aud_test_${randomBytes(5).toString("hex")}`, id, email, id, email, ts());

  return await d.prepare("SELECT * FROM users WHERE id = ?").get(id);
}

after(async () => {
  for (const { id, email } of made) {
    await d.prepare("DELETE FROM audit_log WHERE actor_id = ? OR target_id = ?").run(id, id);
    await d.prepare("DELETE FROM mail_outbox WHERE recipient = ?").run(email);
    await d.prepare("DELETE FROM users WHERE id = ?").run(id);
  }
  await d.prepare("DELETE FROM audit_log WHERE id LIKE 'aud_test_%'").run();
  await closePool();
});

describe("taking a copy of your data", () => {
  test("carries the account, the page and its contents", async () => {
    const user = await buildAccount();
    const data = await exportAccount(user);

    assert.equal(data.account.email, user.email);
    assert.equal(data.portfolios.length, 1);
    assert.equal(data.projects.length, 1);
    assert.equal(data.projects[0].title, "A project");
    assert.ok(data.exported_at, "the file should say when it was made");
  });

  test("never includes the password hash", async () => {
    const user = await buildAccount();
    const data = await exportAccount(user);

    assert.equal("password_hash" in data.account, false);
    assert.ok(
      !JSON.stringify(data).includes("scrypt$fake"),
      "no credential material anywhere in the file",
    );
  });

  test("lists uploads by address rather than inlining megabytes of image", async () => {
    const user = await buildAccount();
    const data = await exportAccount(user);

    assert.equal(data.uploads.length, 1);
    assert.ok(data.uploads[0].storage_path, "an upload needs its location");
    assert.equal("bytes" in data.uploads[0], false, "the file itself does not belong in the JSON");
  });
});

describe("deleting an account", () => {
  /**
   * The cascade is a promise the schema makes. This is the one operation where
   * a promise that quietly failed would leave someone's data behind after they
   * were told it was gone, so it is checked rather than trusted.
   */
  test("leaves nothing behind", async () => {
    const user = await buildAccount();
    assert.ok((await accountRemnants(user.id, user.email)) > 0, "fixture should exist first");

    await deleteAccount(user);

    assert.equal(
      await accountRemnants(user.id, user.email),
      0,
      "something survived the deletion",
    );
  });

  test("reaches the tables no foreign key cascades through", async () => {
    const user = await buildAccount();
    await deleteAccount(user);

    const mail = await d
      .prepare("SELECT COUNT(*) AS n FROM mail_outbox WHERE recipient = ?")
      .get(user.email);
    assert.equal(Number(mail.n), 0, "mail_outbox is keyed by address, not by user");
  });

  test("keeps the audit trail but takes the person out of it", async () => {
    const user = await buildAccount();
    await deleteAccount(user);

    const rows = await d
      .prepare("SELECT actor_id, actor_email FROM audit_log WHERE target_id = ?")
      .all(user.id);

    assert.ok(rows.length > 0, "the entry itself should survive — it is a security record");
    for (const row of rows) {
      assert.equal(row.actor_id, null, "the identifier must go");
      assert.equal(row.actor_email, "", "and so must the address");
    }
  });

  test("the page and its contents go with it", async () => {
    const user = await buildAccount();
    await deleteAccount(user);

    const portfolios = await d
      .prepare("SELECT COUNT(*) AS n FROM portfolios WHERE user_id = ?")
      .get(user.id);
    assert.equal(Number(portfolios.n), 0);
  });
});
