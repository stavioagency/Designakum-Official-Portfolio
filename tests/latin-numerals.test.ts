import test, { describe } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Numbers are written in Latin digits everywhere, including Arabic.
 *
 * Arabic-Indic digits (٠١٢٣…) are correct Arabic, but the product mixes prices,
 * dates and counts from `Intl` — which is configured for Latin digits — with
 * copy written by hand. Two numeral systems on one screen reads as a bug, so
 * the whole product uses one.
 */
const ARABIC_INDIC = /[٠-٩۰-۹]/u;

const SKIP_DIRS = new Set(["node_modules", ".next", ".next-build", ".git", "dist"]);

function* sourceFiles(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      yield* sourceFiles(full);
      continue;
    }
    if (/\.(ts|tsx|mjs|sql)$/.test(entry)) yield full;
  }
}

describe("numerals", () => {
  test("no Arabic-Indic digits are shipped in source or seed data", () => {
    const offenders: string[] = [];

    for (const file of sourceFiles("src")) {
      const text = readFileSync(file, "utf8");
      text.split("\n").forEach((line, i) => {
        if (ARABIC_INDIC.test(line)) offenders.push(`${file}:${i + 1}`);
      });
    }
    for (const file of sourceFiles("scripts")) {
      const text = readFileSync(file, "utf8");
      text.split("\n").forEach((line, i) => {
        if (ARABIC_INDIC.test(line)) offenders.push(`${file}:${i + 1}`);
      });
    }

    assert.deepEqual(
      offenders,
      [],
      `Write these with Latin digits (0-9):\n  ${offenders.join("\n  ")}`,
    );
  });

  /**
   * The other half of the rule: a formatter asked for Arabic without saying
   * which numbering system gives Arabic-Indic digits back, which is how this
   * reappears at runtime rather than in the source above.
   */
  test("every Arabic date or number formatter asks for Latin digits", () => {
    const offenders: string[] = [];

    /**
     * Locale tags that are not ours to format with. PayPal's
     * `application_context.locale` picks the language of PayPal's own checkout
     * pages; it takes a plain tag and would reject a `-u-nu-latn` extension.
     */
    const NOT_A_FORMATTER = new Set(["src/lib/paypal.ts: ar-SA"]);

    for (const file of sourceFiles("src")) {
      const text = readFileSync(file, "utf8");
      for (const match of text.matchAll(/["'`](ar(?:-[A-Za-z0-9]+)*)["'`]/g)) {
        const tag = match[1];
        // Bare "ar" is the app's own locale key, not a formatter locale.
        if (tag === "ar") continue;
        const where = `${file}: ${tag}`;
        if (NOT_A_FORMATTER.has(where)) continue;
        if (!tag.includes("nu-latn")) offenders.push(where);
      }
    }

    assert.deepEqual(
      offenders,
      [],
      `Add -u-nu-latn so these format with Latin digits:\n  ${offenders.join("\n  ")}`,
    );
  });
});
