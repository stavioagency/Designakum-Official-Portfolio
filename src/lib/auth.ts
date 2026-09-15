import "server-only";
import { cookies } from "next/headers";
import fs from "node:fs";
import path from "node:path";
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { all, get, now, run } from "./db";
import { newId, newToken } from "./ids";
import type { Role, User } from "./types";

const COOKIE = "dk_session";
const SESSION_TTL = 1000 * 60 * 60 * 24 * 30; // 30 days

/**
 * Session cookies are signed with this. A hard-coded fallback would be published
 * in the repository, which makes every session on every deployment forgeable — so
 * production refuses to start without a real secret, and development generates a
 * private one per machine instead of sharing a known constant.
 */
function resolveSecret(): string {
  const configured = process.env.AUTH_SECRET;
  if (configured && configured.length >= 32) return configured;

  // `next build` imports this module to collect page data but never serves a
  // request, so a missing secret must not fail the build — only the server.
  const building = process.env.NEXT_PHASE === "phase-production-build";

  if (process.env.NODE_ENV === "production" && !building) {
    throw new Error(
      "AUTH_SECRET is missing or too short. Set it to at least 32 random characters " +
        "(for example: openssl rand -base64 48) before starting Designakum in production.",
    );
  }

  const devSecretPath = path.join(process.cwd(), "data", ".dev-session-secret");
  try {
    return fs.readFileSync(devSecretPath, "utf8").trim();
  } catch {
    const generated = randomBytes(48).toString("base64url");
    fs.mkdirSync(path.dirname(devSecretPath), { recursive: true });
    fs.writeFileSync(devSecretPath, generated, { mode: 0o600 });
    return generated;
  }
}

const SECRET = resolveSecret();

/* ------------------------------------------------------------------ passwords */

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const derived = scryptSync(password.normalize("NFKC"), salt, 64);
  return `scrypt$${salt.toString("hex")}$${derived.toString("hex")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, saltHex, hashHex] = stored.split("$");
  if (scheme !== "scrypt" || !saltHex || !hashHex) return false;
  const derived = scryptSync(password.normalize("NFKC"), Buffer.from(saltHex, "hex"), 64);
  const expected = Buffer.from(hashHex, "hex");
  return derived.length === expected.length && timingSafeEqual(derived, expected);
}

/* ------------------------------------------------------------------- sessions */

const sign = (value: string) => createHmac("sha256", SECRET).update(value).digest("hex");

function seal(sessionId: string) {
  return `${sessionId}.${sign(sessionId)}`;
}

function unseal(raw: string | undefined): string | null {
  if (!raw) return null;
  const idx = raw.lastIndexOf(".");
  if (idx < 0) return null;
  const id = raw.slice(0, idx);
  const mac = raw.slice(idx + 1);
  const expected = sign(id);
  if (mac.length !== expected.length) return null;
  return timingSafeEqual(Buffer.from(mac), Buffer.from(expected)) ? id : null;
}

export async function createSession(userId: string) {
  const id = newToken();
  const ts = now();
  await run(
    "INSERT INTO sessions (id, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)",
    id,
    userId,
    ts,
    ts + SESSION_TTL,
  );
  const jar = await cookies();
  jar.set(COOKIE, seal(id), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL / 1000,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const id = await unseal(jar.get(COOKIE)?.value);
  if (id) await run("DELETE FROM sessions WHERE id = ?", id);
  jar.delete(COOKIE);
}

/* ---------------------------------------------------------------- current user */

export async function currentUser(): Promise<User | null> {
  const jar = await cookies();
  const sessionId = await unseal(jar.get(COOKIE)?.value);
  if (!sessionId) return null;

  const session = await get<{ user_id: string; expires_at: number }>(
    "SELECT user_id, expires_at FROM sessions WHERE id = ?",
    sessionId,
  );
  if (!session) return null;
  if (session.expires_at < now()) {
    await run("DELETE FROM sessions WHERE id = ?", sessionId);
    return null;
  }

  const user = await get<User>("SELECT * FROM users WHERE id = ?", session.user_id);
  if (!user || user.status === "suspended") return null;

  // Coarse last-seen tracking: one write a day per user, enough for "active users"
  // without turning every request into a database write.
  const today = new Date().setHours(0, 0, 0, 0);
  if (!user.last_seen_at || user.last_seen_at < today) {
    await run("UPDATE users SET last_seen_at = ? WHERE id = ?", now(), user.id);
  }
  return user;
}

export async function requireUser(): Promise<User> {
  const user = await currentUser();
  if (!user) throw new AuthError("يجب تسجيل الدخول للمتابعة");
  return user;
}

export async function requireOwner(): Promise<User> {
  const user = await requireUser();
  if (user.role !== "owner") throw new AuthError("هذه الصفحة متاحة لمالك المنصة فقط");
  return user;
}

export class AuthError extends Error {}

/* -------------------------------------------------------------------- accounts */

export async function findUserByEmail(email: string) {
  return await get<User>("SELECT * FROM users WHERE email = ?", email.trim().toLowerCase());
}

export async function createUser(input: {
  email: string;
  password?: string;
  displayName: string;
  role?: Role;
  googleId?: string;
  avatarUrl?: string;
  provider?: "password" | "google";
}): Promise<User>{
  const ts = now();
  const id = newId("usr");
  await run(
    `INSERT INTO users (id, email, password_hash, display_name, role, status, plan,
       google_id, avatar_url, auth_provider, locale, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'active', 'free', ?, ?, ?, 'ar', ?, ?)`,
    id,
    input.email.trim().toLowerCase(),
    // A Google account has no password; the empty hash can never verify.
    input.password ? hashPassword(input.password) : "",
    input.displayName.trim(),
    input.role ?? "client",
    input.googleId ?? null,
    input.avatarUrl ?? "",
    input.provider ?? (input.googleId ? "google" : "password"),
    ts,
    ts,
  );
  return (await get<User>("SELECT * FROM users WHERE id = ?", id))!;
}

export async function findUserByGoogleId(googleId: string) {
  return await get<User>("SELECT * FROM users WHERE google_id = ?", googleId);
}

/** Attaches a Google identity to an account that already exists for that email. */
export async function linkGoogleAccount(userId: string, googleId: string, avatarUrl: string) {
  await run(
    `UPDATE users SET google_id = ?, avatar_url = CASE WHEN avatar_url = '' THEN ? ELSE avatar_url END,
       updated_at = ? WHERE id = ?`,
    googleId,
    avatarUrl,
    now(),
    userId,
  );
}

export async function setUserLocale(userId: string, locale: "ar" | "en") {
  await run("UPDATE users SET locale = ?, updated_at = ? WHERE id = ?", locale, now(), userId);
}

export async function listUsers() {
  return await all<User>("SELECT * FROM users ORDER BY created_at DESC");
}

export async function revokeSessionsFor(userId: string) {
  await run("DELETE FROM sessions WHERE user_id = ?", userId);
}
