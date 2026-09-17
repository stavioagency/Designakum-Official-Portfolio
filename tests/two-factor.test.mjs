import test, { after, describe } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { CONNECTION_STRING, closePool, db } from "./helpers.mjs";

process.env.DATABASE_URL ??= CONNECTION_STRING;

const twoFactor = await import("../src/lib/two-factor.ts");
const { codeForStep } = await import("../src/lib/totp.ts");

const d = db();
const made = [];

async function account() {
  const id = `usr_2fa_${randomBytes(6).toString("hex")}`;
  made.push(id);
  const ts = Date.now();
  await d
    .prepare(
      `INSERT INTO users (id, email, password_hash, display_name, role, status, locale, created_at, updated_at)
       VALUES (?, ?, 'scrypt$fake', 'Owner', 'owner', 'active', 'ar', ?, ?)`,
    )
    .run(id, `${id}@example.test`, ts, ts);
  return await d.prepare("SELECT * FROM users WHERE id = ?").get(id);
}

const fresh = async (id) => await d.prepare("SELECT * FROM users WHERE id = ?").get(id);
const codeNow = (secret) => codeForStep(secret, Math.floor(Date.now() / 1000 / 30));

after(async () => {
  for (const id of made) await d.prepare("DELETE FROM users WHERE id = ?").run(id);
  await closePool();
});

describe("turning two-step verification on", () => {
  /**
   * The secret is not written until a code from the app has been checked. An
   * account that pairs badly and walks away would otherwise be locked out of
   * itself — and for the last owner, that is the platform.
   */
  test("a wrong code changes nothing at all", async () => {
    const user = await account();
    const { secret } = await twoFactor.beginEnrolment();

    const result = await twoFactor.enable(user, secret, "000000");
    assert.equal(result.ok, false);

    const after = await fresh(user.id);
    assert.equal(after.two_factor_enabled, 0, "must not be switched on");
    assert.equal(after.two_factor_secret, "", "and must not store the secret");
  });

  test("a correct code switches it on and hands back recovery codes", async () => {
    const user = await account();
    const { secret } = await twoFactor.beginEnrolment();

    const result = await twoFactor.enable(user, secret, codeNow(secret));
    assert.equal(result.ok, true);
    assert.equal(result.recoveryCodes.length, 10);

    const after = await fresh(user.id);
    assert.equal(after.two_factor_enabled, 1);
    assert.equal(twoFactor.isEnabled(after), true);
  });

  test("re-enrolling retires the previous recovery codes", async () => {
    const user = await account();
    const first = await twoFactor.beginEnrolment();
    const one = await twoFactor.enable(user, first.secret, codeNow(first.secret));

    const second = await twoFactor.beginEnrolment();
    await twoFactor.enable(await fresh(user.id), second.secret, codeNow(second.secret));

    const stale = await twoFactor.verifySecondFactor(await fresh(user.id), one.recoveryCodes[0]);
    assert.equal(stale, false, "an old printout must not open a re-secured account");
  });
});

describe("signing in with it", () => {
  test("accepts the code the app is showing", async () => {
    const user = await account();
    const { secret } = await twoFactor.beginEnrolment();
    await twoFactor.enable(user, secret, codeNow(secret));

    const ready = await fresh(user.id);
    assert.equal(await twoFactor.verifySecondFactor(ready, codeNow(secret)), true);
    assert.equal(await twoFactor.verifySecondFactor(ready, "111111"), false);
  });

  test("a recovery code works once, and only once", async () => {
    const user = await account();
    const { secret } = await twoFactor.beginEnrolment();
    const { recoveryCodes } = await twoFactor.enable(user, secret, codeNow(secret));
    const ready = await fresh(user.id);

    assert.equal(await twoFactor.verifySecondFactor(ready, recoveryCodes[0]), true, "first use");
    assert.equal(
      await twoFactor.verifySecondFactor(ready, recoveryCodes[0]),
      false,
      "a spent code must not work again",
    );
    assert.equal(
      await twoFactor.verifySecondFactor(ready, recoveryCodes[1]),
      true,
      "the others still work",
    );
  });

  test("recovery codes are stored hashed, never in the clear", async () => {
    const user = await account();
    const { secret } = await twoFactor.beginEnrolment();
    const { recoveryCodes } = await twoFactor.enable(user, secret, codeNow(secret));

    const rows = await d
      .prepare("SELECT code_hash FROM two_factor_recovery WHERE user_id = ?")
      .all(user.id);

    for (const row of rows) {
      assert.ok(!recoveryCodes.includes(row.code_hash), "a plain code is in the table");
      assert.match(row.code_hash, /^[0-9a-f]{64}$/, "should be a sha256 digest");
    }
  });

  test("the count of remaining codes goes down as they are spent", async () => {
    const user = await account();
    const { secret } = await twoFactor.beginEnrolment();
    const { recoveryCodes } = await twoFactor.enable(user, secret, codeNow(secret));

    assert.equal(await twoFactor.recoveryCodesLeft(user.id), 10);
    await twoFactor.verifySecondFactor(await fresh(user.id), recoveryCodes[0]);
    assert.equal(await twoFactor.recoveryCodesLeft(user.id), 9);
  });
});

describe("turning it off", () => {
  test("leaves nothing that could still demand a code", async () => {
    const user = await account();
    const { secret } = await twoFactor.beginEnrolment();
    await twoFactor.enable(user, secret, codeNow(secret));

    await twoFactor.disable(await fresh(user.id));

    const after = await fresh(user.id);
    assert.equal(twoFactor.isEnabled(after), false);
    assert.equal(after.two_factor_secret, "");
    assert.equal(await twoFactor.recoveryCodesLeft(user.id), 0);
  });
});
