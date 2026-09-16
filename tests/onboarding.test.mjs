import test, { after, describe } from "node:test";
import assert from "node:assert/strict";
import { closePool, db, sessionFor, visit } from "./helpers.mjs";

after(closePool);

/**
 * The step where a customer claims their own portfolio link.
 *
 * It exists because Google sign-in cannot ask for one, so the account is given a
 * generated slug it never agreed to. The risk of a gate like this is the other
 * direction: trapping accounts that never needed it. Both are checked here.
 */
describe("claiming your link", () => {
  const clear = async (email) => {
    const connection = db();
    const user = await connection.prepare("SELECT id FROM users WHERE email = ?").get(email);
    await connection
      .prepare("UPDATE users SET onboarded_at = NULL WHERE id = ?")
      .run(user.id);
    connection.close();
    return user.id;
  };

  const restore = async (id) => {
    const connection = db();
    await connection
      .prepare("UPDATE users SET onboarded_at = created_at WHERE id = ?")
      .run(id);
    connection.close();
  };

  test("an established customer is never sent back through it", async () => {
    const cookie = await sessionFor("faisal@designakum.sa");

    const dashboard = await visit("/dashboard", { cookie });
    assert.equal(dashboard.status, 200, "a customer with a link should land in the editor");

    const welcome = await visit("/welcome", { cookie });
    assert.equal(welcome.status, 307, "and be turned away from the step they finished");
    assert.equal(welcome.headers.get("location")?.replace(/^https?:\/\/[^/]+/, ""), "/dashboard");
  });

  test("a customer who has not chosen one is asked before anything else", async () => {
    const id = await clear("faisal@designakum.sa");
    try {
      const cookie = await sessionFor("faisal@designakum.sa");

      const welcome = await visit("/welcome", { cookie });
      assert.equal(welcome.status, 200, "the step itself should open");
      assert.ok(welcome.body.includes("/p/"), "and show the link they are about to claim");

      const dashboard = await visit("/dashboard", { cookie });
      assert.equal(dashboard.status, 307, "the editor should send them to it first");
      assert.equal(
        dashboard.headers.get("location")?.replace(/^https?:\/\/[^/]+/, ""),
        "/welcome",
      );
    } finally {
      await restore(id);
    }
  });

  test("the availability check refuses to answer strangers", async () => {
    // Otherwise it is a way to enumerate which customers exist.
    const anonymous = await visit("/api/portfolio/slug?slug=faisal");
    assert.equal(anonymous.status, 401);

    const cookie = await sessionFor("alex@designakum.sa");
    const taken = await visit("/api/portfolio/slug?slug=faisal", { cookie });
    assert.equal(JSON.parse(taken.body).status, "taken");

    const free = await visit("/api/portfolio/slug?slug=nobody-has-this-one", { cookie });
    assert.equal(JSON.parse(free.body).status, "available");

    const mine = await visit("/api/portfolio/slug?slug=alex", { cookie });
    assert.equal(JSON.parse(mine.body).status, "available", "their own link is not taken from them");
  });
});
