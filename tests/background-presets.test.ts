import "./resolve-hooks.mjs";
import assert from "node:assert/strict";
import test from "node:test";

const { surfaceFromHex, contrast } = await import("../src/lib/surface.ts");

/**
 * Kept in step with BACKGROUNDS in src/components/editor/profile-section.tsx.
 * A preset that cannot carry readable text is a trap: the customer picks a
 * colour we offered them and gets a page nobody can read.
 */
const OFFERED = [
  "#07080e", "#ffffff", "#f5f0e8", "#0f172a", "#1e3a8a", "#0f766e",
  "#166534", "#7c2d12", "#9f1239", "#6d28d9", "#c2410c", "#facc15",
];

test("every offered background is accepted and readable", () => {
  for (const hex of OFFERED) {
    const surface = surfaceFromHex(hex);
    assert.ok(surface, `${hex} was refused by the palette`);
    const ratio = contrast(surface.text, surface.page);
    // 4.5:1 is the WCAG AA threshold for body text.
    assert.ok(ratio >= 4.5, `${hex} gives body text only ${ratio.toFixed(2)}:1`);
  }
});

test("the light ones are recognised as light", () => {
  for (const hex of ["#ffffff", "#f5f0e8", "#facc15"]) {
    assert.equal(surfaceFromHex(hex)?.isLight, true, `${hex} was treated as a dark page`);
  }
});
