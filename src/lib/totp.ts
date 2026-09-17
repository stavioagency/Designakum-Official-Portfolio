import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Time-based one-time passwords, the six digits an authenticator app shows.
 *
 * Written here rather than pulled in: RFC 6238 is an HMAC, a counter and a
 * truncation, all of which node:crypto already does. The only fiddly part is
 * base32, which authenticator apps expect and which is twenty lines.
 *
 * No `server-only`: this is arithmetic over a secret the caller supplies, and
 * keeping it importable by a test is worth more than the guard.
 */

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

/** Base32 without padding, which is what every authenticator app accepts. */
export function base32Encode(bytes: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = "";

  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(input: string): Buffer {
  const clean = input.toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = 0;
  let value = 0;
  const out: number[] = [];

  for (const char of clean) {
    const index = ALPHABET.indexOf(char);
    if (index < 0) continue;
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/** 20 bytes, which is the SHA-1 block size these codes are derived with. */
export function generateSecret(): string {
  return base32Encode(randomBytes(20));
}

const STEP_SECONDS = 30;
const DIGITS = 6;

/** The code for one 30-second step. */
export function codeForStep(secret: string, step: number): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));

  const digest = createHmac("sha1", base32Decode(secret)).update(counter).digest();
  // Dynamic truncation, RFC 4226 §5.4: the low nibble of the last byte picks
  // where in the digest the number comes from.
  const offset = digest[digest.length - 1] & 0x0f;
  const binary =
    ((digest[offset] & 0x7f) << 24) |
    (digest[offset + 1] << 16) |
    (digest[offset + 2] << 8) |
    digest[offset + 3];

  return String(binary % 10 ** DIGITS).padStart(DIGITS, "0");
}

/**
 * Checks a code against the current step and one either side.
 *
 * The window exists because phones and servers disagree about the time by a few
 * seconds, and because a person reads six digits and then types them. One step
 * each way is ninety seconds of tolerance, which is the usual trade: wider
 * starts meaningfully extending how long a shoulder-surfed code stays usable.
 */
export function verifyCode(secret: string, code: string, atMs = Date.now()): boolean {
  const typed = code.replace(/\D/g, "");
  if (typed.length !== DIGITS) return false;

  const step = Math.floor(atMs / 1000 / STEP_SECONDS);
  for (const drift of [0, -1, 1]) {
    const expected = Buffer.from(codeForStep(secret, step + drift));
    const actual = Buffer.from(typed);
    if (expected.length === actual.length && timingSafeEqual(expected, actual)) return true;
  }
  return false;
}

/**
 * The string an authenticator app reads from a QR code.
 *
 * The issuer appears twice by design: once as a prefix on the label, which is
 * what older apps show, and once as a parameter, which is what current ones
 * read. Apps that understand both agree; apps that understand one still get it.
 */
export function otpauthUri(secret: string, account: string, issuer = "Designakum"): string {
  const label = encodeURIComponent(`${issuer}:${account}`);
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: "SHA1",
    digits: String(DIGITS),
    period: String(STEP_SECONDS),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}

/**
 * Codes for getting back in when the phone is gone.
 *
 * Without these, turning on two-factor is a way to lose an account rather than
 * protect one — and for the last owner, a way to lose the platform. Ten, each
 * usable once, shown once at enrolment.
 */
export function generateRecoveryCodes(count = 10): string[] {
  return Array.from({ length: count }, () =>
    randomBytes(5).toString("hex").toUpperCase().match(/.{1,5}/g)!.join("-"),
  );
}
