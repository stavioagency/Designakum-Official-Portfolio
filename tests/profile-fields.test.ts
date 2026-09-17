import "./resolve-hooks.mjs";
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

/**
 * Every field the profile form renders must be read by the action that saves it.
 *
 * This is a source-level check rather than a behavioural one because the failure
 * it catches is silent by nature: `seo_title`, `seo_description` and
 * `og_image_url` were on the form for weeks, accepted what was typed, reported
 * "saved", and were never once read by the action. Nothing threw and nothing
 * looked wrong. A test that drove the form would have passed too, because the
 * form does work; it is the wiring behind it that was missing.
 */
const form = readFileSync(new URL("../src/components/editor/profile-section.tsx", import.meta.url), "utf8");
const action = readFileSync(new URL("../src/app/actions/portfolio.ts", import.meta.url), "utf8");

/** Handled by their own controls or actions rather than by name in the patch. */
const ELSEWHERE = new Set(["portfolioId", "theme", "avatar", "favicon"]);

test("no field on the profile form is silently dropped when saving", () => {
  const named = new Set(
    [...form.matchAll(/(?:name)=["{]"?([a-z_]+)"/g)].map((m) => m[1]),
  );
  const missing = [...named].filter(
    (field) => !ELSEWHERE.has(field) && !action.includes(`"${field}"`),
  );
  assert.deepEqual(missing, [], `the save action never reads: ${missing.join(", ")}`);
});
