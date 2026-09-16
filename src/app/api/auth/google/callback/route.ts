import { NextResponse } from "next/server";
import { createSession, findUserByEmail, findUserByGoogleId, linkGoogleAccount } from "@/lib/auth";
import { consumeState, exchangeGoogleCode, googleConfigured } from "@/lib/google";
import { provisionClient } from "@/lib/provision";
import { needsOnboarding } from "@/lib/onboarding";
import { cookies } from "next/headers";
import { isLocale } from "@/lib/i18n";
import { LOCALE_COOKIE, currentLocale, localeCookieOptions } from "@/lib/locale";
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

  const stored = await consumeState(state);
  if (!stored) return fail(origin, "google_expired");

  let profile;
  try {
    profile = await exchangeGoogleCode(code, stored.verifier, origin);
  } catch {
    return fail(origin, "google_failed");
  }

  if (!profile.emailVerified) return fail(origin, "google_unverified");

  let user = await findUserByGoogleId(profile.sub);

  if (!user) {
    const existing = await findUserByEmail(profile.email);
    if (existing) {
      // Same person, already registered with a password — link the identities.
      await linkGoogleAccount(existing.id, profile.sub, profile.picture);
      user = await findUserByGoogleId(profile.sub) ?? existing;
    } else {
      user = (await provisionClient({
        email: profile.email,
        name: profile.name || profile.givenName || profile.email.split("@")[0],
        googleId: profile.sub,
        avatarUrl: profile.picture,
        // Google sign-in starts at the gate like everything else.
        locale: await currentLocale(),
        // Google gives us no portfolio link, so the customer picks one next.
        chooseOwnLink: true,
      })).user;
    }
  }

  if (user.status === "suspended") return fail(origin, "suspended");

  await createSession(user.id);

  // The account's language, not this browser's, once there is an account.
  if (isLocale(user.locale)) {
    (await cookies()).set(LOCALE_COOKIE, user.locale, localeCookieOptions);
  }

  // A brand-new Google account has a generated link it has never seen. Send it to
  // the step that lets the customer claim one, wherever they were headed.
  const destination = needsOnboarding(user)
    ? "/welcome"
    : user.role === "client"
      ? stored.returnTo
      : "/console";
  return NextResponse.redirect(`${origin}${destination}`);
}
