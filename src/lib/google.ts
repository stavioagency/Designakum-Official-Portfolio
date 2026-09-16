import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { get, now, run } from "./db";

const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";

export const googleConfigured = () =>
  Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

export function googleRedirectUri(origin: string) {
  // `??` only falls back on null and undefined, so an environment variable that
  // exists but is empty passed straight through — and Google was being sent
  // `redirect_uri=` with nothing after it, which it rejects. An empty value
  // means "not configured", the same as an absent one.
  const configured = process.env.GOOGLE_REDIRECT_URI?.trim();
  return configured || `${origin}/api/auth/google/callback`;
}

const base64url = (buffer: Buffer) => buffer.toString("base64url");

/** Builds the consent URL and stores the matching state + PKCE verifier. */
export async function beginGoogleAuth(origin: string, returnTo: string) {
  const state = await base64url(randomBytes(24));
  const verifier = await base64url(randomBytes(48));
  const challenge = await base64url(createHash("sha256").update(verifier).digest());

  await run(
    "INSERT INTO oauth_states (state, verifier, created_at) VALUES (?, ?, ?)",
    state,
    `${verifier}|${returnTo}`,
    now(),
  );
  // Anything older than 15 minutes is abandoned; clear it out while we're here.
  await run("DELETE FROM oauth_states WHERE created_at < ?", now() - 15 * 60 * 1000);

  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: googleRedirectUri(origin),
    response_type: "code",
    scope: "openid email profile",
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
    access_type: "online",
    prompt: "select_account",
  });

  return `${AUTH_ENDPOINT}?${params}`;
}

export async function consumeState(
  state: string,
): Promise<{ verifier: string; returnTo: string } | null> {
  const row = await get<{ verifier: string }>(
    "SELECT verifier FROM oauth_states WHERE state = ?",
    state,
  );
  if (!row) return null;
  await run("DELETE FROM oauth_states WHERE state = ?", state);

  const [verifier, returnTo = "/dashboard"] = row.verifier.split("|");
  return { verifier, returnTo };
}

export interface GoogleProfile {
  sub: string;
  email: string;
  emailVerified: boolean;
  name: string;
  givenName: string;
  picture: string;
}

export async function exchangeGoogleCode(
  code: string,
  verifier: string,
  origin: string,
): Promise<GoogleProfile> {
  const response = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: googleRedirectUri(origin),
      grant_type: "authorization_code",
      code_verifier: verifier,
    }),
  });

  if (!response.ok) {
    throw new Error(`Google rejected the code exchange (${response.status})`);
  }

  const token = (await response.json()) as { id_token?: string };
  if (!token.id_token) throw new Error("Google returned no id_token");

  // The token came straight from Google's endpoint over TLS using our client
  // secret, so per OpenID Connect §3.1.3.7 the signature needn't be re-verified
  // here. If tokens ever arrive by any other path, verify against Google's JWKS.
  const [, payload] = token.id_token.split(".");
  const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Record<string, string | boolean>;

  if (!claims.sub || !claims.email) throw new Error("Google returned an incomplete profile");

  return {
    sub: String(claims.sub),
    email: String(claims.email).toLowerCase(),
    emailVerified: claims.email_verified === true || claims.email_verified === "true",
    name: String(claims.name ?? ""),
    givenName: String(claims.given_name ?? claims.name ?? ""),
    picture: String(claims.picture ?? ""),
  };
}
