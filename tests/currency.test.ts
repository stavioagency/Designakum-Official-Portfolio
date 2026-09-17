import "./resolve-hooks.mjs";
import test, { describe } from "node:test";
import assert from "node:assert/strict";

const { CURRENCIES, currencyForCountry, formatMoney, fromUsd, isConverted, isCurrency } =
  await import("../src/lib/currency.ts");

describe("picking the reader's money", () => {
  test("each Gulf country gets its own currency", () => {
    assert.equal(currencyForCountry("SA"), "SAR");
    assert.equal(currencyForCountry("AE"), "AED");
    assert.equal(currencyForCountry("KW"), "KWD");
    assert.equal(currencyForCountry("BH"), "BHD");
    assert.equal(currencyForCountry("OM"), "OMR");
    assert.equal(currencyForCountry("QA"), "QAR");
  });

  test("Britain and Australia get theirs", () => {
    assert.equal(currencyForCountry("GB"), "GBP");
    assert.equal(currencyForCountry("AU"), "AUD");
  });

  /**
   * Everywhere else sees dollars, which is also the currency the card is
   * actually charged in — so a visitor outside the list is shown the exact
   * amount they will pay, with nothing approximate about it.
   */
  test("anywhere else falls back to the currency we actually charge", () => {
    for (const country of ["FR", "JP", "BR", "ZA", "IN", "", null, undefined]) {
      assert.equal(currencyForCountry(country as string), "USD");
    }
    assert.equal(isConverted("USD"), false);
  });

  test("a lower-case or padded country code still resolves", () => {
    assert.equal(currencyForCountry("sa"), "SAR");
    assert.equal(currencyForCountry(" gb "), "GBP");
  });
});

describe("converting the charge", () => {
  /**
   * The Gulf pegs are set by central banks rather than by a market. If these
   * drift, prices across six countries are quietly wrong.
   */
  test("the pegs are the published ones", () => {
    assert.equal(CURRENCIES.SAR.perUsd, 3.75);
    assert.equal(CURRENCIES.AED.perUsd, 3.6725);
    assert.equal(CURRENCIES.QAR.perUsd, 3.64);
    assert.equal(CURRENCIES.BHD.perUsd, 0.376);
    assert.equal(CURRENCIES.OMR.perUsd, 0.3845);
  });

  test("the three-decimal currencies keep three", () => {
    for (const code of ["KWD", "BHD", "OMR"] as const) {
      assert.equal(CURRENCIES[code].decimals, 3, `${code} prices to three places`);
    }
    assert.equal(formatMoney(fromUsd(3.2, "BHD"), "BHD"), "1.203");
  });

  test("a dollar price converts to the peg exactly", () => {
    assert.equal(fromUsd(3.2, "SAR"), 12);
    assert.equal(fromUsd(32, "SAR"), 120);
    assert.equal(fromUsd(1, "USD"), 1);
  });

  test("a rate from settings overrides the built-in one", () => {
    assert.equal(fromUsd(10, "GBP"), 7.9);
    assert.equal(fromUsd(10, "GBP", { GBP: 0.8 }), 8);
  });

  test("Kuwait is marked as the one Gulf rate that is not a dollar peg", () => {
    assert.equal(CURRENCIES.KWD.pegged, false, "it pegs to a basket, so it drifts");
    for (const code of ["SAR", "AED", "QAR", "BHD", "OMR"] as const) {
      assert.equal(CURRENCIES[code].pegged, true);
    }
  });
});

describe("writing it down", () => {
  test("Latin digits in Arabic too", () => {
    const arabic = formatMoney(1234.5, "SAR", "ar");
    assert.match(arabic, /[0-9]/, "must use Latin digits");
    assert.ok(!/[٠-٩]/.test(arabic), "and never Arabic-Indic ones");
  });

  test("an unknown code is refused rather than guessed at", () => {
    assert.equal(isCurrency("SAR"), true);
    assert.equal(isCurrency("XYZ"), false);
    assert.equal(isCurrency(""), false);
  });
});
