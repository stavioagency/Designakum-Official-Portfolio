import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { BASE, BROWSER_UA, contains, db, sessionFor, visit } from "./helpers.mjs";

describe("response hardening", () => {
  test("security headers are present on every page", async () => {
    const result = await visit("/");
    for (const header of [
      "content-security-policy",
      "x-content-type-options",
      "x-frame-options",
      "referrer-policy",
      "permissions-policy",
    ]) {
      assert.ok(result.headers.get(header), `missing ${header}`);
    }
    assert.equal(result.headers.get("x-frame-options"), "DENY");
    assert.equal(result.headers.get("x-powered-by"), null);

    const csp = result.headers.get("content-security-policy");
    assert.match(csp, /object-src 'none'/);

    // The script policy must carry a per-request nonce, and a second request must
    // get a different one — a fixed nonce is the same as no nonce.
    const nonce = csp.match(/'nonce-([a-f0-9]{32})'/)?.[1];
    assert.ok(nonce, `script-src has no nonce: ${csp}`);

    const again = await visit("/");
    const second = again.headers.get("content-security-policy").match(/'nonce-([a-f0-9]{32})'/)?.[1];
    assert.notEqual(second, nonce, "the nonce must be generated per request");

    // Every inline script Next emits has to carry it, or the page is broken the
    // moment 'unsafe-inline' comes off in production.
    const inlineScripts = result.body.match(/<script(?![^>]*\ssrc=)[^>]*>/g) ?? [];
    assert.ok(inlineScripts.length > 0, "the page should have inline scripts to check");
    for (const tag of inlineScripts) {
      assert.match(tag, new RegExp(`nonce="${nonce}"`), `inline script without the nonce: ${tag}`);
    }
  });

  test("the console is marked never-index", async () => {
    const result = await visit("/console");
    assert.match(result.headers.get("x-robots-tag") ?? "", /noindex/);
  });
});

describe("stored links cannot execute script", () => {
  test("a javascript: URL never reaches the rendered page", async () => {
    const connection = db();
    const portfolio = await connection.prepare("SELECT id FROM portfolios WHERE slug = 'faisal'").get();
    const original = await connection
      .prepare("SELECT url FROM socials WHERE portfolio_id = ? ORDER BY position LIMIT 1")
      .get(portfolio.id);

    await connection
      .prepare("UPDATE socials SET url = ? WHERE portfolio_id = ? AND position = 0")
      .run("javascript:alert(document.cookie)", portfolio.id);
    connection.close();

    try {
      const result = await visit("/p/faisal");
      assert.equal(result.status, 200);
      assert.ok(!contains(result, "javascript:alert"), "hostile URL was rendered");
    } finally {
      const restore = db();
      await restore
        .prepare("UPDATE socials SET url = ? WHERE portfolio_id = ? AND position = 0")
        .run(original.url, portfolio.id);
      restore.close();
    }
  });
});

describe("authentication", () => {
  test("the console is closed to anonymous visitors", async () => {
    const result = await visit("/console");
    assert.ok(result.status === 307 || result.status === 302, `expected a redirect, got ${result.status}`);
    assert.match(result.headers.get("location") ?? "", /\/login/);
  });

  test("a forged session signature is rejected", async () => {
    const valid = await sessionFor("admin@designakum.sa");
    const [name, value] = valid.split("=");
    const [id] = value.split(".");
    const forged = `${name}=${id}.${"0".repeat(64)}`;

    const result = await visit("/console", { cookie: forged });
    assert.ok(result.status === 307 || result.status === 302, "forged cookie was accepted");
  });

  test("an unknown session id is rejected", async () => {
    const result = await visit("/console", { cookie: "dk_session=nonexistent.deadbeef" });
    assert.ok(result.status === 307 || result.status === 302);
  });
});

describe("tenant isolation", () => {
  test("a customer cannot open another customer's ticket", async () => {
    const connection = db();
    const ticket = await connection
      .prepare(
        "SELECT t.id, u.email FROM tickets t JOIN users u ON u.id = t.user_id LIMIT 1",
      )
      .get();
    connection.close();
    assert.ok(ticket, "seed data should include a ticket");

    const owner = ticket.email;
    const other = owner === "faisal@designakum.sa" ? "noura@designakum.sa" : "faisal@designakum.sa";

    const mine = await visit(`/dashboard/support/${ticket.id}`, { cookie: await sessionFor(owner) });
    assert.equal(mine.status, 200, "the owner should see their own ticket");

    const theirs = await visit(`/dashboard/support/${ticket.id}`, { cookie: await sessionFor(other) });
    assert.equal(theirs.status, 404, "another customer must not see it");
  });

  test("a client cannot reach the console", async () => {
    const result = await visit("/console/customers", {
      cookie: await sessionFor("faisal@designakum.sa"),
      redirect: "follow",
    });
    assert.ok(
      new URL(result.url).pathname === "/dashboard" || !contains(result, "إدارة حسابات العملاء"),
      "a client saw console content",
    );
  });
});

describe("staff permissions", () => {
  test("an owner reaches the audit log", async () => {
    const result = await visit("/console/audit", { cookie: await sessionFor("admin@designakum.sa") });
    assert.equal(result.status, 200);
    assert.ok(contains(result, "سجل التدقيق"));
  });

  test("a support agent is kept out of the audit log, settings and invitations", async () => {
    const cookie = await sessionFor("support@designakum.sa");

    // Next answers a redirect thrown mid-stream with HTTP 200 and the destination
    // inside the payload, so the meaningful checks are: the redirect was issued,
    // and none of the restricted page's data was rendered before it.
    const privileged = {
      "/console/audit": ["portfolio.suspended", "settings.updated", "invitation.redeemed"],
      "/console/settings": ["AUTH_SECRET", "مفتاح توقيع الجلسات", "حساب فريق جديد"],
      "/console/invitations": ["DZKM1-WELCM", "مرات الاستخدام"],
    };

    for (const [restricted, secrets] of Object.entries(privileged)) {
      const result = await visit(restricted, { cookie });
      assert.match(result.body, /denied=/, `${restricted} did not redirect a support agent`);

      for (const secret of secrets) {
        assert.ok(
          !contains(result, secret),
          `${restricted} leaked "${secret}" to a support agent`,
        );
      }
    }
  });

  test("an owner does see what a support agent is refused", async () => {
    const cookie = await sessionFor("admin@designakum.sa");
    const invitations = await visit("/console/invitations", { cookie });
    assert.ok(contains(invitations, "DZKM1-WELCM"), "the owner should see invitation codes");
  });

  test("a support agent still works their own queues", async () => {
    const cookie = await sessionFor("support@designakum.sa");
    for (const allowed of ["/console", "/console/customers", "/console/moderation", "/console/support"]) {
      const result = await visit(allowed, { cookie });
      assert.equal(result.status, 200, `${allowed} should be open to support`);
    }
  });
});

describe("public surfaces", () => {
  test("a published portfolio is served", async () => {
    const result = await visit("/p/faisal");
    assert.equal(result.status, 200);
    assert.ok(contains(result, "فيصل فهد"));
  });

  test("a suspended portfolio is withheld from the public but shown to staff", async () => {
    const connection = db();
    const portfolio = await connection.prepare("SELECT id FROM portfolios WHERE slug = 'noura'").get();
    await connection
      .prepare("UPDATE portfolios SET suspended = 1, suspended_reason = 'test' WHERE id = ?")
      .run(portfolio.id);
    connection.close();

    try {
      const anonymous = await visit("/p/noura");
      assert.ok(contains(anonymous, "موقوف"), "a suspended portfolio was served to the public");

      const staff = await visit("/p/noura", { cookie: await sessionFor("admin@designakum.sa") });
      assert.ok(contains(staff, "نورة"), "staff should still see the content under review");
    } finally {
      const restore = db();
      await restore
        .prepare("UPDATE portfolios SET suspended = 0, suspended_reason = '' WHERE id = ?")
        .run(portfolio.id);
      restore.close();
    }
  });

  test("legal pages are reachable", async () => {
    for (const page of ["/legal/terms", "/legal/privacy", "/legal/rules"]) {
      const result = await visit(page);
      assert.equal(result.status, 200, `${page} should render`);
    }
    const missing = await visit("/legal/not-a-document");
    assert.equal(missing.status, 404);
  });

  test("the tracking endpoint refuses junk", async () => {
    const bad = await fetch(`${BASE}/api/track`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "user-agent": BROWSER_UA },
      body: JSON.stringify({ portfolioId: "nope", kind: "view" }),
    });
    assert.ok(bad.status === 400 || bad.status === 404, `expected a rejection, got ${bad.status}`);
  });
});
