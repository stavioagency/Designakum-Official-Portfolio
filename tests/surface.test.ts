import "./resolve-hooks.mjs";
import test, { describe } from "node:test";
import assert from "node:assert/strict";

/**
 * Loaded dynamically, not with a static import: surface.ts imports "./accent"
 * without an extension, and ESM resolves every static import in the graph
 * before any module body runs — so the hooks above would register too late.
 */
const { contrast, luminance, surfaceFromHex, surfaceStyle } = await import(
  "../src/lib/surface.ts"
);

/**
 * A spread that covers the ways a background can be awkward: the two extremes,
 * the mid-greys where nothing is far from anything, fully saturated hues, and
 * the pale tints a designer actually reaches for.
 */
const BACKGROUNDS = [
  "#000000", "#ffffff", "#07080e", "#808080", "#7f7f7f", "#6e6e85",
  "#ff0000", "#00ff00", "#0000ff", "#ffff00", "#00ffff", "#ff00ff",
  "#2563c9", "#f5f1e8", "#fdf2f8", "#0d2450", "#1a1a1a", "#e8e8e8",
  "#3d2b1f", "#c9a227", "#004d40", "#fff8e1",
];

describe("a customer-chosen background", () => {
  test("body text always clears the WCAG AA threshold", () => {
    for (const bg of BACKGROUNDS) {
      const s = surfaceFromHex(bg)!;
      const ratio = contrast(s.textDim, s.page);
      assert.ok(
        ratio >= 4.5,
        `${bg}: dim text only reaches ${ratio.toFixed(2)}:1, needs 4.5`,
      );
    }
  });

  /**
   * Capped by what the background allows. A mid-grey cannot produce 7:1 with
   * anything — pure black against #808080 is 5.32:1 — so the bar is the better
   * of black and white on that ground, and the assertion is that we actually
   * reach it rather than stopping short.
   */
  test("the brightest tone is as strong as the background permits", () => {
    for (const bg of BACKGROUNDS) {
      const s = surfaceFromHex(bg)!;
      const best = Math.max(contrast("#ffffff", s.page), contrast("#000000", s.page));
      const target = Math.min(7, best - 0.01);
      const ratio = contrast(s.text, s.page);
      assert.ok(
        ratio >= target,
        `${bg}: primary reaches ${ratio.toFixed(2)}:1, and ${best.toFixed(2)}:1 was available`,
      );
    }
  });

  test("even the faintest label stays above the large-text floor", () => {
    for (const bg of BACKGROUNDS) {
      const s = surfaceFromHex(bg)!;
      const ratio = contrast(s.textFaint, s.page);
      assert.ok(ratio >= 3, `${bg}: faint text only reaches ${ratio.toFixed(2)}:1`);
    }
  });

  test("the three tones stay ordered, so hierarchy survives", () => {
    for (const bg of BACKGROUNDS) {
      const s = surfaceFromHex(bg)!;
      assert.ok(
        contrast(s.text, s.page) >= contrast(s.textDim, s.page),
        `${bg}: primary is not the strongest tone`,
      );
      assert.ok(
        contrast(s.textDim, s.page) >= contrast(s.textFaint, s.page),
        `${bg}: dim is not stronger than faint`,
      );
    }
  });

  /**
   * The overlays are the design: a card is a translucent lift off the page. On a
   * pale background a white lift is invisible, so it has to darken instead.
   */
  test("surfaces lift away from the page rather than into it", () => {
    for (const bg of BACKGROUNDS) {
      const s = surfaceFromHex(bg)!;
      const overlayIsWhite = s.cardTop.startsWith("rgba(255");
      assert.equal(
        overlayIsWhite,
        !s.isLight,
        `${bg}: a ${s.isLight ? "light" : "dark"} page got ${s.cardTop}`,
      );
    }
  });

  test("a light page is told it is light, so the browser's own chrome follows", () => {
    assert.equal(surfaceStyle("#ffffff")!.colorScheme, "light");
    assert.equal(surfaceStyle("#07080e")!.colorScheme, "dark");
  });

  test("the platform's own background is still treated as dark", () => {
    const s = surfaceFromHex("#07080e")!;
    assert.equal(s.isLight, false);
    assert.ok(luminance(s.page) < 0.05);
  });

  test("anything that is not a colour is refused rather than guessed at", () => {
    for (const bad of ["", "blue", "#12345", "#gggggg", "rgb(0,0,0)"]) {
      assert.equal(surfaceFromHex(bad), null, `${bad} should not parse`);
    }
    assert.equal(surfaceStyle("nonsense"), undefined);
  });

  test("a hex is accepted with or without its hash, in any case", () => {
    assert.equal(surfaceFromHex("2563C9")!.page, "#2563c9");
    assert.equal(surfaceFromHex("#2563c9")!.page, "#2563c9");
  });
});
