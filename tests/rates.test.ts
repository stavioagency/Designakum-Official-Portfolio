import "./resolve-hooks.mjs";
import assert from "node:assert/strict";
import test, { describe } from "node:test";

const { plausible, isStale, pickRate, parseFeed, STALE_AFTER } = await import("../src/lib/rates.ts");
const { CURRENCIES } = await import("../src/lib/currency.ts");

describe("refusing a rate that is not a rate", () => {
  test("a real market move is accepted", () => {
    // Sterling has traded between about 0.70 and 0.90 to the dollar for years.
    assert.ok(plausible("GBP", 0.71));
    assert.ok(plausible("GBP", 0.89));
    assert.ok(plausible("AUD", 1.62));
  });

  test("the shapes a broken feed actually takes are refused", () => {
    assert.equal(plausible("GBP", 0), false, "zero would make everything free");
    assert.equal(plausible("GBP", -0.8), false);
    assert.equal(plausible("GBP", Number.NaN), false);
    assert.equal(plausible("GBP", "0.79"), false, "a string would concatenate, not multiply");
    assert.equal(plausible("GBP", undefined), false);
    // Units inverted: dollars per pound rather than pounds per dollar.
    assert.equal(plausible("GBP", 1 / 0.79), false);
  });
});

describe("which rate wins", () => {
  test("the owner's own figure beats the feed", () => {
    const picked = pickRate("GBP", 0.82, 0.75, Date.now());
    assert.equal(picked.rate, 0.82);
    assert.equal(picked.source, "manual");
  });

  test("the feed beats the number I guessed in the source", () => {
    const picked = pickRate("GBP", 0, 0.751, Date.now());
    assert.equal(picked.rate, 0.751);
    assert.equal(picked.source, "live");
  });

  test("a nonsense cached value falls back rather than pricing from it", () => {
    const picked = pickRate("AUD", 0, 0, Date.now());
    assert.equal(picked.rate, CURRENCIES.AUD.perUsd);
    assert.equal(picked.source, "built-in");
  });
});

describe("staleness", () => {
  test("never fetched is stale", () => {
    assert.equal(isStale(0), true);
  });

  test("this morning is not stale, the day before yesterday is", () => {
    const at = Date.now();
    assert.equal(isStale(at - 60_000, at), false);
    assert.equal(isStale(at - STALE_AFTER - 1, at), true);
  });
});

describe("reading the feed", () => {
  test("a good answer", () => {
    const feed = parseFeed({ amount: 1, base: "USD", date: "2026-09-16", rates: { GBP: 0.74, AUD: 1.49 } });
    assert.equal(feed?.rates.GBP, 0.74);
    assert.equal(feed?.date, "2026-09-16");
  });

  test("a different base is refused, not silently priced from", () => {
    // Asking for USD and being answered in euros would quietly misprice the page.
    assert.equal(parseFeed({ base: "EUR", rates: { GBP: 0.86 } }), null);
  });

  test("an error body is refused", () => {
    assert.equal(parseFeed({ message: "not found" }), null);
    assert.equal(parseFeed("nope"), null);
    assert.equal(parseFeed(null), null);
  });
});
