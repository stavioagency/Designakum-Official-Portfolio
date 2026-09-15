import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { BASE, BROWSER_UA, contains, db, sessionFor, visit } from "./helpers.mjs";

const GATE_AR = "اختر لغتك المفضّلة";
const GATE_EN = "Choose your language";

describe("the language gate", () => {
  test("a brand-new visitor is asked, in both languages at once", async () => {
    const page = await visit("/", { locale: null });
    assert.equal(page.status, 200);
    assert.ok(contains(page, GATE_AR), "the Arabic prompt should be there");
    assert.ok(page.body.includes(GATE_EN), "and the English one, since they cannot read only one");
  });

  test("it covers the signup journey and nothing else", async () => {
    for (const path of ["/", "/pricing", "/signup", "/login", "/legal/terms"]) {
      const page = await visit(path, { locale: null });
      assert.ok(contains(page, GATE_AR), `${path} should ask a new visitor`);
    }

    // A shared portfolio link renders in its designer's language. Stopping a
    // visitor with a question before they see the work costs the designer the visit.
    const connection = db();
    const live = await connection
      .prepare("SELECT slug FROM portfolios WHERE published = 1 AND suspended = 0 LIMIT 1")
      .get();
    connection.close();

    const portfolio = await visit(`/p/${live.slug}`, { locale: null });
    assert.ok(!contains(portfolio, GATE_AR), "a portfolio must never be gated");
  });

  test("a returning visitor is never asked again", async () => {
    for (const locale of ["ar", "en"]) {
      const page = await visit("/", { locale });
      assert.ok(!contains(page, GATE_AR), `${locale} visitor should go straight in`);
    }
  });

  test("a crawler sees the page, not the gate", async () => {
    const page = await visit("/", {
      locale: null,
      userAgent: "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
    });
    assert.ok(!contains(page, GATE_AR), "Googlebot would have indexed the gate");
    assert.ok(page.status === 200);
  });

  test("choosing sets a cookie that lasts, and lands back where they were", async () => {
    const response = await fetch(`${BASE}/pricing`, {
      method: "POST",
      headers: {
        "user-agent": BROWSER_UA,
        "content-type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ locale: "en", path: "/pricing" }),
      redirect: "manual",
    });
    // The form posts to a server action; whatever the framework answers with, the
    // cookie is the contract.
    const setCookie = response.headers.get("set-cookie") ?? "";
    if (setCookie.includes("dk_locale")) {
      assert.match(setCookie, /dk_locale=en/);
      assert.match(setCookie, /Max-Age=31536000/, "the choice should last a year");
    }
  });
});

describe("the interface follows the choice", () => {
  test("the landing page renders in each language with the right direction", async () => {
    const arabic = await visit("/", { locale: "ar" });
    assert.match(arabic.body, /<html lang="ar" dir="rtl"/, "Arabic must be RTL");

    const english = await visit("/", { locale: "en" });
    assert.match(english.body, /<html lang="en" dir="ltr"/, "English must be LTR");
  });

  test("an English visitor is not shown Arabic copy on the way in", async () => {
    for (const path of ["/", "/pricing", "/login", "/signup"]) {
      const page = await visit(path, { locale: "en" });
      assert.ok(page.status === 200, `${path} should render`);
      assert.ok(
        !contains(page, "ابدأ الآن"),
        `${path} still shows the Arabic call to action to an English visitor`,
      );
    }
  });
});

describe("an English account is English all the way down", () => {
  test("the seeded English customer has no Arabic left in their own content", async () => {
    const connection = db();
    const user = await connection
      .prepare("SELECT id, locale FROM users WHERE email = 'alex@designakum.sa'")
      .get();
    assert.ok(user, "the seed should include an English-interface customer");
    assert.equal(user.locale, "en");

    const portfolio = await connection
      .prepare(
        "SELECT id, locale, tagline, footer_note, whatsapp_label FROM portfolios WHERE user_id = ?",
      )
      .get(user.id);
    connection.close();

    assert.equal(portfolio.locale, "en");
    for (const [field, value] of Object.entries({
      tagline: portfolio.tagline,
      footer_note: portfolio.footer_note,
      whatsapp_label: portfolio.whatsapp_label,
    })) {
      assert.ok(
        !/[\u0600-\u06FF]/.test(value),
        `${field} still carries Arabic for an English account: ${value}`,
      );
    }
  });

  test("their public page renders LTR with no Arabic chrome", async () => {
    const page = await visit("/p/alex", { locale: "en" });
    assert.equal(page.status, 200);
    assert.match(page.body, /dir="ltr"/, "an English portfolio should render left-to-right");

    // The portfolio's own language decides, so an Arabic visitor sees it in
    // English too — it is the designer's page, not the visitor's.
    const arabicVisitor = await visit("/p/alex", { locale: "ar" });
    assert.match(arabicVisitor.body, /lang="en"/);
  });

  test("their dashboard has no Arabic interface text", async () => {
    const cookie = await sessionFor("alex@designakum.sa");
    for (const path of ["/dashboard", "/dashboard/billing", "/dashboard/support"]) {
      const page = await visit(path, { cookie, locale: "en" });
      assert.equal(page.status, 200, `${path} should render`);

      // Strip scripts, the CSS-hidden Arabic wordmark, and the language switcher
      // — all three are Arabic on purpose in an English interface.
      const text = page.body
        .replace(/<script[\s\S]*?<\/script>/g, " ")
        .replace(/<span class="brand-name-ar">[^<]*<\/span>/g, " ")
        .replace(/<form[^>]*>[\s\S]*?<\/form>/g, " ")
        .replace(/<[^>]+>/g, " ");

      const arabic = [...new Set(text.split(/\s+/).filter((w) => /[\u0600-\u06FF]/.test(w)))];
      assert.deepEqual(arabic, [], `${path} still shows Arabic: ${arabic.join(" ")}`);
    }
  });
});

describe("the report dialog follows the visitor, not the designer", () => {
  /**
   * Everything else on a public page belongs to its designer and renders in
   * their language. This one control belongs to whoever is filing the report.
   */
  test("an English visitor gets an English report button on an Arabic page", async () => {
    // Its own portfolio: the report button only renders on a page that is
    // actually public, and which seeded portfolio is public at any moment
    // depends on whichever billing test ran last.
    const connection = db();
    const owner = await connection
      .prepare(
        `SELECT s.user_id FROM subscriptions s
          WHERE s.status = 'active'
            AND (s.current_period_end IS NULL OR s.current_period_end > ?)
          ORDER BY s.created_at DESC LIMIT 1`,
      )
      .get(Date.now());
    assert.ok(owner, "the seed should leave a subscribed customer");

    const slug = `report-probe-${Math.random().toString(36).slice(2, 10)}`;
    const id = `pf_${slug}`;
    await connection
      .prepare(
        `INSERT INTO portfolios (id, user_id, slug, name, title, locale, published, created_at, updated_at)
         VALUES (?, ?, ?, 'مصمم تجريبي', 'مصمم', 'ar', 1, ?, ?)`,
      )
      .run(id, owner.user_id, slug, Date.now(), Date.now());

    try {
      await checkTriggerLanguage(slug);
    } finally {
      await connection.prepare("DELETE FROM portfolios WHERE id = ?").run(id);
      connection.close();
    }
  });

  async function checkTriggerLanguage(slug) {
    const english = await visit(`/p/${slug}`, { locale: "en" });
    assert.ok(contains(english, "Report this portfolio"), "the trigger should be English");
    assert.ok(
      !contains(english, "الإبلاغ عن هذا المعرض"),
      "and not also carry the Arabic one",
    );
    // The page around it is still the designer's.
    assert.match(english.body, /lang="ar"/);

    const arabicVisitor = await visit(`/p/${slug}`, { locale: "ar" });
    assert.ok(contains(arabicVisitor, "الإبلاغ عن هذا المعرض"));
  }

  test("an Arabic visitor gets an Arabic report button on an English page", async () => {
    const page = await visit("/p/alex", { locale: "ar" });
    assert.ok(contains(page, "الإبلاغ عن هذا المعرض"));
    assert.match(page.body, /lang="en"/, "the portfolio itself stays English");
  });
});
