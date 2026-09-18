import "./resolve-hooks.mjs";
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const { buttonHref, isUsableButton, BUTTON_KINDS, MAX_BUTTONS } = await import("../src/lib/buttons.ts");

test("a WhatsApp number becomes a wa.me link, however it was typed", () => {
  assert.equal(buttonHref("whatsapp", "966500000000"), "https://wa.me/966500000000");
  assert.equal(buttonHref("whatsapp", "+966 50 000 0000"), "https://wa.me/966500000000");
  // Leading zeros are a local dialling habit and wa.me refuses them.
  assert.equal(buttonHref("whatsapp", "00966500000000"), "https://wa.me/966500000000");
});

test("a number too short to dial is not a button", () => {
  assert.equal(buttonHref("whatsapp", "0500"), null);
  assert.equal(buttonHref("call", "123"), null);
  assert.equal(buttonHref("whatsapp", "   "), null);
});

test("a phone button keeps the plus that makes it dial from abroad", () => {
  assert.equal(buttonHref("call", "+966 50 000 0000"), "tel:+966500000000");
  assert.equal(buttonHref("call", "0500000000"), "tel:0500000000");
});

test("an email button only accepts an address", () => {
  assert.equal(buttonHref("email", "hi@studio.com"), "mailto:hi@studio.com");
  assert.equal(buttonHref("email", "mailto:hi@studio.com"), "mailto:hi@studio.com");
  assert.equal(buttonHref("email", "studio.com"), null);
});

test("a link button refuses anything that could run script", () => {
  assert.equal(buttonHref("link", "calendly.com/feras"), "https://calendly.com/feras");
  assert.equal(buttonHref("link", "javascript:alert(1)"), null);
  assert.equal(buttonHref("link", "data:text/html,<script>"), null);
});

test("an empty button is never usable, whatever its kind", () => {
  for (const kind of BUTTON_KINDS) assert.equal(isUsableButton(kind, ""), false);
});

/**
 * The cap is a product decision, so it is checked where it is enforced rather
 * than trusted to the form: the request that adds the sixth button does not
 * have to come from our own page.
 */
test("the limit is enforced in the data layer, not only in the editor", () => {
  const source = readFileSync(new URL("../src/lib/portfolios.ts", import.meta.url), "utf8");
  assert.equal(MAX_BUTTONS, 5);
  assert.match(source, /LIMITS/);
  assert.match(source, /buttons: MAX_BUTTONS/);
});

/**
 * Every kind needs a mark, a name and a sentence for the button when the
 * customer writes none. A kind added to the list and nowhere else renders a
 * button with no words on it, which nothing else would catch.
 */
test("every kind of button has an icon and wording in both languages", async () => {
  const icons = readFileSync(new URL("../src/components/icons.tsx", import.meta.url), "utf8");
  const meta = icons.slice(icons.indexOf("export const BUTTON_META"));
  const { dict } = await import("../src/lib/i18n.ts");

  for (const kind of BUTTON_KINDS) {
    assert.match(meta, new RegExp(`\\b${kind}:`), `${kind} has no icon or label`);
    for (const locale of ["ar", "en"] as const) {
      const words = dict(locale).portfolio.buttons[kind];
      assert.ok(words && words.trim().length > 0, `${kind} has no ${locale} wording`);
    }
  }
});
