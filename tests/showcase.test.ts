import "./resolve-hooks.mjs";
import assert from "node:assert/strict";
import test from "node:test";

const { pickShowcase } = await import("../src/lib/showcase.ts");

const PAGES = [
  { slug: "noura", locale: "ar" },
  { slug: "alex", locale: "en" },
  { slug: "faisal", locale: "ar" },
  { slug: "sara", locale: "ar" },
];

test("the owner's order is the order", () => {
  const picked = pickShowcase(PAGES, ["alex", "faisal", "noura"], "ar");
  assert.deepEqual(picked.map((p) => p.slug), ["alex", "faisal", "noura"]);
});

test("a name that no longer resolves is skipped, not left blank", () => {
  // The page was unpublished, renamed, or deleted after it was chosen.
  const picked = pickShowcase(PAGES, ["gone", "alex"], "ar");
  assert.equal(picked.length, 3, "left a hole where a page should be");
  assert.equal(picked[0].slug, "alex");
});

test("empty slots fall to the reader's own language first", () => {
  const picked = pickShowcase(PAGES, [], "en");
  assert.equal(picked[0].slug, "alex", "an Arabic reader's page led an English page");
});

test("naming a page twice does not show it twice", () => {
  const picked = pickShowcase(PAGES, ["noura", "noura"], "ar");
  assert.equal(new Set(picked.map((p) => p.slug)).size, picked.length);
});

test("never more than the slots, never more than there are pages", () => {
  assert.equal(pickShowcase(PAGES, [], "ar").length, 3);
  assert.equal(pickShowcase(PAGES.slice(0, 1), [], "ar").length, 1);
  assert.deepEqual(pickShowcase([], ["noura"], "ar"), []);
});
