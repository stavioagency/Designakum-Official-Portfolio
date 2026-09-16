/**
 * What makes a password acceptable, in one place.
 *
 * Deliberately not `server-only`: the sign-up form shows these rules as a live
 * checklist while someone types, and the only way that checklist can be trusted
 * to agree with the server is for both to run this exact code. Five actions set
 * a password — sign-up, reset, change, staff creation, and a staff member
 * setting one for a customer — and each used to carry its own length check.
 *
 * The rules are returned rather than a message, because the words belong to
 * whichever language the reader chose and this module has no business knowing
 * which that is.
 */

export type PasswordRule = "length" | "digit" | "special" | "whitespace" | "tooLong";

export const PASSWORD_MIN = 8;
export const PASSWORD_STAFF_MIN = 12;

/**
 * The cap, in bytes rather than characters.
 *
 * Hashing is expensive on purpose, so an unbounded password is a way to make
 * the server do unbounded work on every guess. 72 bytes is the classic bcrypt
 * ceiling and is plenty for any real passphrase.
 *
 * Bytes, because one Arabic letter costs two and an emoji four — a limit
 * counted in characters would not actually bound the work.
 */
export const PASSWORD_MAX_BYTES = 72;

const DIGIT = /\p{N}/u;
const SPECIAL = /[^\p{L}\p{N}]/u;

export const passwordBytes = (password: string): number =>
  new TextEncoder().encode(password).length;

/** Every rule this password fails. Empty means it is acceptable. */
export function passwordProblems(password: string, min = PASSWORD_MIN): PasswordRule[] {
  const failed: PasswordRule[] = [];

  // Codepoints, not UTF-16 units, so an emoji counts once and an Arabic
  // letter is not worth more than a Latin one.
  if ([...password].length < min) failed.push("length");
  if (!DIGIT.test(password)) failed.push("digit");
  if (!SPECIAL.test(password)) failed.push("special");
  if (password !== password.trim()) failed.push("whitespace");
  if (passwordBytes(password) > PASSWORD_MAX_BYTES) failed.push("tooLong");

  return failed;
}

export const passwordAcceptable = (password: string, min = PASSWORD_MIN): boolean =>
  passwordProblems(password, min).length === 0;

/** The rules in the order the checklist shows them. */
export const PASSWORD_RULES: PasswordRule[] = ["length", "digit", "special", "whitespace"];
