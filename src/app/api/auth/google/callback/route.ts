import { NextResponse } from "next/server";
import { createSession, findUserByEmail, findUserByGoogleId, linkGoogleAccount } from "@/lib/auth";
import { consumeState, exchangeGoogleCode, googleConfigured } from "@/lib/google";
import { provisionClient } from "@/lib/provision";
import { requestOrigin } from "@/lib/origin";

const fail = (origin: string, reason: string) =>
  NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(reason)}`);

export async function GET(request: Request) {
  const origin = await requestOrigin();
  if (!googleConfigured()) return fail(origin, "google_unavailable");

  const params = new URL(request.url).searchParams;
  if (params.get("error")) return fail(origin, "google_denied");

  const code = params.get("code");
  const state = params.get("state");
  if (!code || !state) return fail(origin, "google_invalid");

  const stored = consumeState(state);
  if (!stored) return fail(origin, "google_expired");

  let profile;
  try {
    profile = await exchangeGoogleCode(code, stored.verifier, origin);
  } catch {
    return fail(origin, "google_failed");
  }

  if (!profile.emailVerified) return fail(origin, "google_unverified");

  let user = findUserByGoogleId(profile.sub);

  if (!user) {
    const existing = findUserByEmail(profile.email);
    if (existing) {
      // Same person, already registered with a password — link the identities.
      linkGoogleAccount(existing.id, profile.sub, profile.picture);
      user = findUserByGoogleId(profile.sub) ?? existing;
    } else {
      user = provisionClient({
        email: profile.email,
        name: profile.name || profile.givenName || profile.email.split("@")[0],
        googleId: profile.sub,
        avatarUrl: profile.picture,
      }).user;
    }
  }

  if (user.status === "suspended") return fail(origin, "suspended");

  await createSession(user.id);

  const destination = user.role === "client" ? stored.returnTo : "/console";
  return NextResponse.redirect(`${origin}${destination}`);
}
