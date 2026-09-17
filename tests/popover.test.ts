import "./resolve-hooks.mjs";
import assert from "node:assert/strict";
import test from "node:test";

const { placePanel } = await import("../src/lib/popover.ts");

const VIEWPORT = { width: 1440, height: 900 };

test("a bell near the bottom of the sidebar opens upwards", () => {
  // Where the console actually puts it: the very bottom of a full-height column.
  const box = placePanel({ top: 840, bottom: 876, right: 250 }, VIEWPORT);

  assert.equal(box.top, undefined);
  assert.equal(box.bottom, VIEWPORT.height - 840 + 10);
  // The whole panel is on screen: its top edge is below the viewport's.
  assert.ok(VIEWPORT.height - box.bottom! - box.maxHeight >= 0, "hangs off the top");
});

test("a bell in a top bar still opens downwards", () => {
  const box = placePanel({ top: 16, bottom: 52, right: 1400 }, VIEWPORT);

  assert.equal(box.bottom, undefined);
  assert.equal(box.top, 62);
  assert.ok(box.top! + box.maxHeight <= VIEWPORT.height, "hangs off the bottom");
});

test("never taller than the room it has", () => {
  const cramped = placePanel({ top: 300, bottom: 336, right: 400 }, { width: 1440, height: 500 });
  assert.ok(cramped.maxHeight <= 300, `capped at ${cramped.maxHeight}`);
});

test("stays inside a phone, both edges", () => {
  const phone = { width: 375, height: 812 };
  const box = placePanel({ top: 12, bottom: 48, right: 370 }, phone);

  assert.ok(box.left >= 12, "runs off the start edge");
  assert.ok(box.left + box.width <= phone.width - 12, "runs off the end edge");
});
