import test, { describe } from "node:test";
import assert from "node:assert/strict";
import { toHtml, toText, type Block } from "../src/lib/email-render.ts";

const every: Block[] = [
  { type: "h", text: "أهلاً فيصل" },
  { type: "p", text: "حسابك جاهز." },
  { type: "facts", rows: [["رابط صفحتك", "https://designakum.com/p/faisal"]] },
  { type: "code", label: "رمز الدعوة", value: "DK-7QH2XM" },
  { type: "cta", label: "افتح لوحة التحكم", url: "https://designakum.com/dashboard" },
  { type: "note", text: "الصفحة تبقى خاصة بك إلى أن تنشرها." },
];

const render = (locale: "ar" | "en" = "ar", blocks = every) =>
  toHtml(blocks, { locale, origin: "https://designakum.com", supportEmail: "support@designakum.com" });

/**
 * Every declaration is inline, so an unterminated `style` attribute does not
 * fail loudly — it drops the rest of that element's styling and renders anyway.
 * A font stack quoted with `"Segoe UI"` did exactly that, and looked fine in the
 * source right up until the browser showed a purple underlined button.
 */
describe("the inline styles an email has to carry", () => {
  test("no style attribute is closed early by its own contents", () => {
    for (const locale of ["ar", "en"] as const) {
      const html = render(locale);
      for (const match of html.matchAll(/style="[^"]*"/g)) {
        const after = html[match.index + match[0].length];
        assert.ok(
          after === " " || after === ">" || after === "\n",
          `style attribute in ${locale} ends mid-declaration, followed by ${JSON.stringify(after)}: ${match[0].slice(-60)}`,
        );
      }
    }
  });

  test("the button keeps the colour that makes it legible", () => {
    const html = render("en");
    assert.match(html, /color:#ffffff;text-decoration:none/);
  });
});

describe("what goes into the markup", () => {
  test("text from a template cannot inject markup", () => {
    const html = render("en", [{ type: "p", text: `<script>alert("x")</script>` }]);
    assert.ok(!html.includes("<script>"), "a tag survived escaping");
    assert.match(html, /&lt;script&gt;/);
  });

  test("the logo is absolute, because a mail client has no page to resolve it against", () => {
    assert.match(render(), /src="https:\/\/designakum\.com\/brand\/wordmark-light\.png"/);
  });

  test("Arabic renders right to left and English does not", () => {
    assert.match(render("ar"), /<html lang="ar" dir="rtl">/);
    assert.match(render("en"), /<html lang="en" dir="ltr">/);
  });
});

describe("the plain-text half", () => {
  test("a button becomes a labelled address, the only thing a text reader can use", () => {
    const text = toText(every);
    assert.match(text, /افتح لوحة التحكم:\nhttps:\/\/designakum\.com\/dashboard/);
  });

  test("it carries every word the HTML does", () => {
    const text = toText(every);
    for (const needle of ["أهلاً فيصل", "حسابك جاهز.", "DK-7QH2XM", "الصفحة تبقى خاصة بك"]) {
      assert.ok(text.includes(needle), `missing from the text body: ${needle}`);
    }
  });

  test("it never runs to three blank lines", () => {
    assert.ok(!toText(every).includes("\n\n\n"));
  });
});
