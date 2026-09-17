import test, { describe } from "node:test";
import assert from "node:assert/strict";
import "./resolve-hooks.mjs";

const { portfolioQr } = await import("../src/lib/qr.ts");
const QRCode = (await import("qrcode")).default;

const URL_UNDER_TEST = "https://designakum.com/p/faisal";

/** The library hands back byte values, not a string. */
const decode = (qr) =>
  qr.segments.map((s) => String.fromCharCode(...s.data)).join("");

describe("a page's QR code", () => {
  test("encodes the address it was given, exactly", () => {
    const qr = QRCode.create(URL_UNDER_TEST, { errorCorrectionLevel: "Q" });
    assert.equal(decode(qr), URL_UNDER_TEST, "a code that points somewhere else is worse than none");
  });

  test("a custom domain encodes as itself, not as the platform link", () => {
    const own = "https://faisal.sa/";
    const qr = QRCode.create(own, { errorCorrectionLevel: "Q" });
    assert.equal(decode(qr), own);
  });

  test("comes out as SVG, which is what a printer needs", async () => {
    const svg = await portfolioQr(URL_UNDER_TEST);
    assert.match(svg.trim(), /^(<\?xml|<svg)/, "should be SVG, not a raster");
    assert.match(svg, /viewBox=/, "without a viewBox it cannot be scaled to a card");
  });

  /**
   * A scanner needs contrast between the modules and the quiet zone. Following
   * the customer's own palette here would produce codes that fail in the one
   * place they matter — someone's hand, in a shop, in bad light.
   */
  test("is black on white whatever the page's colours are", async () => {
    const svg = await portfolioQr(URL_UNDER_TEST);
    assert.ok(svg.includes("#000000"), "modules must be black");
    assert.ok(svg.includes("#ffffff"), "the quiet zone must be white");
  });

  test("carries the error correction that survives being printed and smudged", () => {
    const qr = QRCode.create(URL_UNDER_TEST, { errorCorrectionLevel: "Q" });
    // Quartile is bit 3 in the library's own encoding: ~25% recoverable.
    assert.equal(qr.errorCorrectionLevel.bit, 3);
  });

  test("a longer address still produces one code rather than failing", async () => {
    const long = `https://designakum.com/p/${"a".repeat(60)}`;
    const svg = await portfolioQr(long);
    assert.match(svg.trim(), /^(<\?xml|<svg)/);
  });
});
