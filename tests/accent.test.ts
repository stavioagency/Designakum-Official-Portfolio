import test, { describe } from "node:test";
import assert from "node:assert/strict";
import { accentFromHex, normaliseHex } from "../src/lib/accent.ts";

describe("a custom accent colour", () => {
  test("one colour becomes a gradient and a ring", () => {
    const a = accentFromHex("#D56637")!;
    assert.equal(a.from, "#d56637");
    assert.notEqual(a.to, a.from, "the gradient needs two ends");
    assert.notEqual(a.ring, a.from);
  });

  test("the far end is darker and the ring is lighter", () => {
    const lum = (hex: string) => {
      const n = parseInt(hex.slice(1), 16);
      return ((n >> 16 & 255) + (n >> 8 & 255) + (n & 255)) / 3;
    };
    const a = accentFromHex("#2563c9")!;
    assert.ok(lum(a.to) < lum(a.from), "gradient should darken");
    assert.ok(lum(a.ring) > lum(a.from), "ring should lighten");
  });

  test("a very dark colour still gets a visible ring", () => {
    // The ring sits on a near-black page. Derived naively from #0a0a0a it would
    // be invisible, so it has a floor.
    const a = accentFromHex("#0a0a0a")!;
    const lum = parseInt(a.ring.slice(1, 3), 16);
    assert.ok(lum > 120, `ring too dark to see: ${a.ring}`);
  });

  test("it accepts what people actually type, and refuses the rest", () => {
    assert.equal(normaliseHex("#D56637"), "#d56637");
    assert.equal(normaliseHex("D56637"), "#d56637", "a missing # is not a mistake worth failing");
    assert.equal(normaliseHex("  #d56637  "), "#d56637");

    for (const bad of ["#fff", "red", "#gggggg", "", "#12345", "rgb(1,2,3)"]) {
      assert.equal(normaliseHex(bad), null, `should refuse ${JSON.stringify(bad)}`);
    }
  });

  test("it cannot smuggle anything into a style attribute", () => {
    // This value reaches the DOM as an inline custom property.
    assert.equal(normaliseHex("#fff;background:url(x)"), null);
    assert.equal(accentFromHex("</style><script>"), null);
  });
});
