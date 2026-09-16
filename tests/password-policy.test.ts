import test, { describe } from "node:test";
import assert from "node:assert/strict";
import {
  PASSWORD_MAX_BYTES,
  PASSWORD_STAFF_MIN,
  passwordAcceptable,
  passwordBytes,
  passwordProblems,
} from "../src/lib/password-policy.ts";

describe("password policy", () => {
  test("it wants length, a digit and a symbol", () => {
    assert.deepEqual(passwordProblems("Passw0rd!"), []);

    assert.deepEqual(passwordProblems("Pw0rd!"), ["length"]);
    assert.deepEqual(passwordProblems("Password!"), ["digit"]);
    assert.deepEqual(passwordProblems("Password1"), ["special"]);
  });

  test("it reports every failure at once, not the first", () => {
    // The checklist shows all four rules, so it has to know about all four.
    assert.deepEqual(passwordProblems("abc"), ["length", "digit", "special"]);
  });

  test("whitespace at either end is a mistake, not a character", () => {
    assert.deepEqual(passwordProblems(" Passw0rd!"), ["whitespace"]);
    assert.deepEqual(passwordProblems("Passw0rd! "), ["whitespace"]);
    // Inside is fine — a passphrase is a reasonable thing to type.
    assert.deepEqual(passwordProblems("correct horse 9!"), []);
  });

  test("Arabic counts, and so do Arabic digits", () => {
    // Hashing an Arabic passphrase is no different, and refusing one would be
    // absurd on a platform built for Arabic.
    assert.deepEqual(passwordProblems("كلمةسر١٢٣!"), []);
    // A letter is a letter: Arabic script must not satisfy "special".
    assert.deepEqual(passwordProblems("كلمةالسر١٢٣"), ["special"]);
  });

  test("the cap is in bytes, because that is what the work is", () => {
    const latin = "a".repeat(PASSWORD_MAX_BYTES) + "1!";
    assert.ok(passwordProblems(latin).includes("tooLong"));

    // 36 Arabic letters are 72 bytes: half the characters, the same cost.
    const arabic = "ك".repeat(36);
    assert.equal(passwordBytes(arabic), PASSWORD_MAX_BYTES);
    assert.ok(!passwordProblems(arabic + "1!").includes("length"));
    assert.ok(passwordProblems(arabic + "1!").includes("tooLong"));
  });

  test("staff carry a longer minimum", () => {
    assert.ok(passwordAcceptable("Passw0rd!"));
    assert.ok(!passwordAcceptable("Passw0rd!", PASSWORD_STAFF_MIN));
    assert.ok(passwordAcceptable("Passw0rd!Passw0rd!", PASSWORD_STAFF_MIN));
  });

  test("an emoji is one character and four bytes", () => {
    assert.equal(passwordBytes("🔐"), 4);
    // Eight emoji: eight characters by codepoint, so length passes.
    assert.ok(!passwordProblems("🔐".repeat(8) + "1!").includes("length"));
  });
});
