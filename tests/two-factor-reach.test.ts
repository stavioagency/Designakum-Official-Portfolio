import "./resolve-hooks.mjs";
import assert from "node:assert/strict";
import test, { describe } from "node:test";
import { readFileSync } from "node:fs";

/**
 * Two-step verification has to be reachable by a customer, not only by staff.
 *
 * The lock itself was always role-blind: sign-in challenges any account with it
 * switched on, and the actions that turn it on ask only for a signed-in user.
 * What was missing for months was a button, and nothing failed, because a
 * feature nobody can reach throws no errors.
 */
const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

describe("a customer can turn on two-step verification", () => {
  test("the panel is in the customer's own settings, not only the console", () => {
    const settings = read("../src/components/editor/settings-section.tsx");
    assert.match(settings, /<TwoFactor/, "the customer settings tab has no two-factor panel");
  });

  test("the dashboard supplies it with a real secret and a code to scan", () => {
    const page = read("../src/app/dashboard/page.tsx");
    assert.match(page, /generateSecret\(\)/, "no enrolment secret is generated");
    assert.match(page, /otpauthUri\(/, "nothing for an authenticator app to scan");
  });

  test("signing in challenges by enrolment, never by role", () => {
    const auth = read("../src/app/actions/auth.ts");
    const challenge = auth.slice(auth.indexOf("export async function loginAction"));
    assert.match(challenge, /if \(isEnabled\(user\)\)/, "the challenge is gone");
    assert.doesNotMatch(
      challenge.slice(0, challenge.indexOf("startSecondFactor")),
      /role !== "client"|role === "owner"/,
      "the challenge was made conditional on who the account belongs to",
    );
  });

  test("turning it on asks only for a signed-in user", () => {
    const auth = read("../src/app/actions/auth.ts");
    const enable = auth.slice(auth.indexOf("export async function enableTwoFactorAction"));
    const body = enable.slice(0, enable.indexOf("await audit"));
    assert.match(body, /requireUser\(\)/);
    assert.doesNotMatch(body, /requirePermission/, "customers would be locked out of their own security");
  });
});
