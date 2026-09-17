import "./resolve-hooks.mjs";
import test, { describe } from "node:test";
import assert from "node:assert/strict";

const { base32Decode, base32Encode, codeForStep, generateRecoveryCodes, generateSecret, otpauthUri, verifyCode } =
  await import("../src/lib/totp.ts");

describe("one-time codes", () => {
  /**
   * The published RFC 6238 vectors, with the SHA-1 secret "12345678901234567890"
   * base32-encoded. If these drift, every authenticator app in the world
   * disagrees with us and nobody can sign in.
   */
  const RFC_SECRET = base32Encode(Buffer.from("12345678901234567890", "ascii"));

  test("matches the RFC 6238 test vectors", () => {
    // time, expected 6 digits (truncated from the RFC's 8-digit SHA-1 rows)
    const vectors: [number, string][] = [
      [59, "287082"],
      [1111111109, "081804"],
      [1111111111, "050471"],
      [1234567890, "005924"],
      [2000000000, "279037"],
    ];

    for (const [seconds, expected] of vectors) {
      const step = Math.floor(seconds / 30);
      assert.equal(codeForStep(RFC_SECRET, step), expected, `at t=${seconds}`);
    }
  });

  test("base32 survives a round trip", () => {
    const original = Buffer.from("designakum-secret-01", "ascii");
    assert.deepEqual(base32Decode(base32Encode(original)), original);
  });

  test("a fresh secret produces a code an app would accept", () => {
    const secret = generateSecret();
    const now = Date.now();
    const code = codeForStep(secret, Math.floor(now / 1000 / 30));
    assert.equal(verifyCode(secret, code, now), true);
  });

  test("tolerates a clock a step out, in either direction", () => {
    const secret = generateSecret();
    const now = Date.now();
    const step = Math.floor(now / 1000 / 30);

    assert.equal(verifyCode(secret, codeForStep(secret, step - 1), now), true, "phone behind");
    assert.equal(verifyCode(secret, codeForStep(secret, step + 1), now), true, "phone ahead");
  });

  test("refuses one that is two steps stale, so a code does not live for minutes", () => {
    const secret = generateSecret();
    const now = Date.now();
    const step = Math.floor(now / 1000 / 30);
    assert.equal(verifyCode(secret, codeForStep(secret, step - 2), now), false);
  });

  test("refuses the wrong code, the wrong length and the wrong secret", () => {
    const secret = generateSecret();
    const other = generateSecret();
    const now = Date.now();
    const valid = codeForStep(secret, Math.floor(now / 1000 / 30));

    assert.equal(verifyCode(secret, "000000", now), valid === "000000");
    assert.equal(verifyCode(secret, "12345", now), false, "five digits is not a code");
    assert.equal(verifyCode(secret, "", now), false);
    assert.equal(verifyCode(other, valid, now), false, "another secret must not match");
  });

  test("spaces and dashes a person types are ignored", () => {
    const secret = generateSecret();
    const now = Date.now();
    const code = codeForStep(secret, Math.floor(now / 1000 / 30));
    assert.equal(verifyCode(secret, `${code.slice(0, 3)} ${code.slice(3)}`, now), true);
  });
});

describe("enrolment", () => {
  test("the QR string carries what an authenticator app needs", () => {
    const uri = otpauthUri("ABCDEFGHIJKLMNOP", "owner@designakum.com");
    assert.match(uri, /^otpauth:\/\/totp\//);
    assert.match(uri, /secret=ABCDEFGHIJKLMNOP/);
    assert.match(uri, /issuer=Designakum/);
    assert.match(uri, /digits=6/);
    assert.match(uri, /period=30/);
  });

  /**
   * Without these, turning on two-factor is a way to lose an account rather
   * than protect one — and for the last owner, a way to lose the platform.
   */
  test("recovery codes are unique and there are enough of them", () => {
    const codes = generateRecoveryCodes();
    assert.equal(codes.length, 10);
    assert.equal(new Set(codes).size, 10, "a repeat would be one fewer way back in");
    for (const code of codes) assert.match(code, /^[0-9A-F]{5}-[0-9A-F]{5}$/);
  });
});
