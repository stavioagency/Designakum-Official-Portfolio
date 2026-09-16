import test, { after, describe } from "node:test";
import assert from "node:assert/strict";
import { closePool, db, sessionFor, visit } from "./helpers.mjs";

after(closePool);

/**
 * Custom domains.
 *
 * The interesting cases are the refusals: a name that belongs to the platform,
 * a name already claimed by another customer, and a name pointed at us by
 * someone who never proved they control it.
 */
describe("custom domains", () => {
  const sql = async (statement, ...params) => {
    const connection = db();
    const rows = await connection.prepare(statement).all(...params);
    connection.close();
    return rows;
  };

  const exec = async (statement, ...params) => {
    const connection = db();
    await connection.prepare(statement).run(...params);
    connection.close();
  };

  const portfolioOf = async (email) =>
    (await sql(
      `SELECT p.id, p.slug FROM portfolios p
         JOIN users u ON u.id = p.user_id WHERE u.email = ?`,
      email,
    ))[0];

  test("an unverified name resolves to nothing, not to someone else's work", async () => {
    const faisal = await portfolioOf("faisal@designakum.sa");
    const id = `dom_test_${Date.now()}`;
    await exec(
      `INSERT INTO domains (id, portfolio_id, hostname, status, verify_token, created_at, updated_at)
       VALUES (?, ?, 'unverified-example.test', 'pending', 'dk-verify-nope', ?, ?)`,
      id, faisal.id, Date.now(), Date.now(),
    );

    try {
      const page = await visit("/sites/unverified-example.test");
      assert.equal(page.status, 404, "a pending domain must not serve the portfolio");

      // The same name, once verified, is the whole point of the feature.
      await exec("UPDATE domains SET status = 'active' WHERE id = ?", id);
      const live = await visit("/sites/unverified-example.test");
      assert.equal(live.status, 200);
      assert.ok(live.body.includes("فيصل"), "and it should be the right portfolio");
    } finally {
      await exec("DELETE FROM domains WHERE id = ?", id);
    }
  });

  test("a hostname nobody claimed is a 404, not a crash", async () => {
    const page = await visit("/sites/nobody-claimed-this.test");
    assert.equal(page.status, 404);
  });

  test("the panel is behind a subscription", async () => {
    const free = await sql(
      `SELECT u.email FROM users u
         JOIN portfolios p ON p.user_id = u.id
        WHERE u.role = 'client' AND u.plan = 'free' LIMIT 1`,
    );
    if (!free[0]) return; // nothing to assert against in this dataset

    const page = await visit("/dashboard/domain", { cookie: await sessionFor(free[0].email) });
    assert.equal(page.status, 200, "the page still opens, so they can see what it costs");
    assert.ok(
      page.body.includes("اشتراك") || page.body.includes("subscription"),
      "and says the feature comes with a subscription",
    );
  });

  test("one hostname cannot belong to two portfolios", async () => {
    const faisal = await portfolioOf("faisal@designakum.sa");
    const alex = await portfolioOf("alex@designakum.sa");
    const ts = Date.now();

    await exec(
      `INSERT INTO domains (id, portfolio_id, hostname, status, verify_token, created_at, updated_at)
       VALUES ('dom_unique_a', ?, 'contested.test', 'active', 'dk-verify-a', ?, ?)`,
      faisal.id, ts, ts,
    );
    try {
      await assert.rejects(
        exec(
          `INSERT INTO domains (id, portfolio_id, hostname, status, verify_token, created_at, updated_at)
           VALUES ('dom_unique_b', ?, 'contested.test', 'pending', 'dk-verify-b', ?, ?)`,
          alex.id, ts, ts,
        ),
        "the database, not the action, is what settles this race",
      );
    } finally {
      await exec("DELETE FROM domains WHERE hostname = 'contested.test'");
    }
  });
});
