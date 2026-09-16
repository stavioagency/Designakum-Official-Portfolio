"use server";

import { cookies } from "next/headers";
import { messages } from "@/lib/locale";
import { fill } from "@/lib/i18n";
import { redirect } from "next/navigation";
import {
  createSession,
  currentUser,
  destroySession,
  findUserByEmail,
  hashPassword,
  requireUser,
  revokeSessionsFor,
  setUserLocale,
  verifyPassword,
} from "@/lib/auth";
import { audit } from "@/lib/audit";
import { now, run } from "@/lib/db";
import { provisionClient } from "@/lib/provision";
import { slugify } from "@/lib/ids";
import { LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE, currentLocale } from "@/lib/locale";
import { isLocale } from "@/lib/i18n";
import { readSettings } from "@/lib/settings";
import { checkInvitation, redeemInvitation } from "@/lib/invitations";
import { callerFingerprint, rateLimit } from "@/lib/rate-limit";
import { consumeReset, createPasswordReset, findValidReset } from "@/lib/password-reset";
import { emailConfigured, sendMail } from "@/lib/mailer";
import { emailTemplate } from "@/lib/emails";
import { requestOrigin } from "@/lib/origin";
import { get } from "@/lib/db";
import { reportError } from "@/lib/observability";
import type { Locale, User } from "@/lib/types";

/** `error` is a key into the `authErrors` dictionary, so it can be shown in either language. */
export type FormState = { error?: string } | null;

const str = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();

export async function signupAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const email = str(fd, "email").toLowerCase();
  const password = String(fd.get("password") ?? "");
  const name = str(fd, "name");
  const title = str(fd, "title");
  const desiredSlug = str(fd, "slug") || name;

  // Creating an account writes a user, a portfolio and starter content, so it is
  // throttled per caller the same way sign-in attempts are.
  const fingerprint = await callerFingerprint();
  const signups = await rateLimit(`signup:${fingerprint}`, 3, 60 * 60 * 1000);
  if (!signups.ok) return { error: "too_many_signups" };

  const settings = await readSettings();
  const inviteCode = str(fd, "invite");

  // An invitation is what reopens a closed or invite-only platform.
  const invitation = inviteCode ? await checkInvitation(inviteCode, email) : null;
  const hasValidInvite = Boolean(invitation && "invitation" in invitation);

  if (invitation && "problem" in invitation) return { error: `invite_${invitation.problem}` };
  if (!settings["platform.signups_open"] && !hasValidInvite) return { error: "signups_closed" };
  if (settings["platform.invite_only"] && !hasValidInvite) return { error: "invite_required" };

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: "invalid_email" };
  if (password.length < 8) return { error: "weak_password" };
  if (name.length < 2) return { error: "short_name" };
  if (!slugify(desiredSlug)) return { error: "bad_slug" };
  if (await findUserByEmail(email)) return { error: "email_taken" };

  // Whatever they picked at the gate is the account's language from here on:
  // starter copy, dashboard, and every email we ever send them.
  const locale = await currentLocale();
  const { user, slug } = await provisionClient({
    email,
    password,
    name,
    title,
    slug: desiredSlug,
    locale,
  });
  if (invitation && "invitation" in invitation) await redeemInvitation(invitation.invitation, user);

  await createSession(user.id);
  await sendWelcome(user, slug, locale);

  redirect("/dashboard");
}

/**
 * The one email a new account gets. It carries the page's URL, because the URL
 * is the thing people actually signed up for and the thing they will want to
 * find again a week later.
 *
 * Never blocks the sign-up: a mail provider being down is not a reason to refuse
 * someone an account, so a failure is recorded in mail_outbox and dropped here.
 */
async function sendWelcome(user: User, slug: string, locale: Locale) {
  try {
    const origin = await requestOrigin();
    const composed = emailTemplate.welcome(locale, {
      name: user.display_name || "",
      portfolioUrl: `${origin}/p/${slug}`,
      dashboardUrl: `${origin}/dashboard`,
    });
    await sendMail({
      to: user.email,
      subject: composed.subject,
      kind: "welcome",
      body: composed.body,
    });
  } catch (error) {
    reportError(error, { area: "welcome-email", userId: user.id });
  }
}

export async function loginAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const email = str(fd, "email").toLowerCase();
  const password = String(fd.get("password") ?? "");

  // Throttle password guessing per caller and per account.
  const fingerprint = await callerFingerprint();
  const attempts = await rateLimit(`login:${fingerprint}:${email}`, 8, 15 * 60 * 1000);
  if (!attempts.ok) return { error: "too_many_attempts" };

  const user = await findUserByEmail(email);
  if (!user || !verifyPassword(password, user.password_hash)) {
    return { error: "bad_credentials" };
  }
  if (user.status === "suspended") {
    return { error: "suspended" };
  }

  await createSession(user.id);
  await adoptAccountLocale(user);
  redirect(user.role === "client" ? "/dashboard" : "/console");
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}

/**
 * Signing in adopts the account's language, not the browser's.
 *
 * Someone who set the site to English on their laptop and then signs in on a
 * borrowed phone should get English, without being asked again.
 */
async function adoptAccountLocale(user: { locale?: string | null }) {
  if (!isLocale(user.locale)) return;
  (await cookies()).set(LOCALE_COOKIE, user.locale, {
    path: "/",
    maxAge: LOCALE_COOKIE_MAX_AGE,
    sameSite: "lax",
  });
}

/** Switches the interface language and reloads whatever page the visitor is on. */
export async function setLocaleAction(fd: FormData) {
  const locale = String(fd.get("locale") ?? "");
  const path = String(fd.get("path") ?? "/");

  if (isLocale(locale)) {
    (await cookies()).set(LOCALE_COOKIE, locale, {
      path: "/",
      maxAge: LOCALE_COOKIE_MAX_AGE,
      sameSite: "lax",
    });

    // The cookie is this browser's; the account's copy is what email is written
    // in, so someone who switches language stops getting mail in the other one.
    const user = await currentUser();
    if (user) await setUserLocale(user.id, locale);
  }

  redirect(path.startsWith("/") && !path.startsWith("//") ? path : "/");
}


/**
 * Lets a customer rotate their own password — the thing you need the moment a
 * laptop is lost. Every other session is dropped, and a fresh one is issued so
 * the person doing the rotation is not logged out of the tab they are using.
 */
export async function changePasswordAction(
  _prev: { ok?: string; error?: string } | null,
  fd: FormData,
): Promise<{ ok?: string; error?: string } | null> {
  try {
    const user = await requireUser();

    const current = String(fd.get("current") ?? "");
    const next = String(fd.get("next") ?? "");
    const confirm = String(fd.get("confirm") ?? "");

    const hasPassword = user.password_hash !== "";

    if (hasPassword && !verifyPassword(current, user.password_hash)) {
      return { error: (await messages()).wrongCurrentPassword };
    }
    if (next.length < 8) return { error: (await messages()).weakPassword };
    if (next !== confirm) return { error: (await messages()).passwordMismatch };
    if (hasPassword && next === current) return { error: (await messages()).samePassword };

    await run(
      "UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?",
      hashPassword(next),
      now(),
      user.id,
    );

    // Drop every session, including this one, then re-issue for this browser.
    await revokeSessionsFor(user.id);
    await createSession(user.id);

    await audit({
      actor: user,
      action: hasPassword ? "account.password_changed" : "account.password_set",
      targetType: "user",
      targetId: user.id,
      targetLabel: user.email,
      detail: (await messages()).sessionsEndedByOwner,
    });

    const m = await messages();
    return { ok: hasPassword ? m.passwordChanged : m.passwordSet };
  } catch (error) {
    return { error: error instanceof Error ? error.message : (await messages()).passwordChangeFailed };
  }
}


/* ------------------------------------------------------------ password reset */

/**
 * Always answers the same way whether or not the address exists — a reset form
 * that says "no such account" is an account enumeration oracle.
 */
export async function requestPasswordResetAction(
  _prev: { ok?: string; error?: string } | null,
  fd: FormData,
): Promise<{ ok?: string; error?: string } | null> {
  const email = String(fd.get("email") ?? "").trim().toLowerCase();

  const fingerprint = await callerFingerprint();
  const limit = await rateLimit(`reset:${fingerprint}`, 5, 60 * 60 * 1000);
  if (!limit.ok) return { error: "tooMany" };

  const neutral = { ok: "sent" };

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return neutral;

  const user = await findUserByEmail(email);
  if (!user || user.status === "suspended") return neutral;

  const token = await createPasswordReset(user);
  const origin = await requestOrigin();
  const link = `${origin}/reset/${token}`;

  // Their language, not this browser's: someone can request a reset from a
  // machine that has never seen the site.
  const composed = emailTemplate.passwordReset(user.locale, {
    name: user.display_name || "",
    link,
  });

  const result = await sendMail({
    to: user.email,
    subject: composed.subject,
    kind: "password_reset",
    body: composed.body,
  });

  // Without a mail provider the link cannot reach anyone, and saying otherwise
  // would leave the customer waiting for an email that will never arrive.
  if (!result.delivered && !emailConfigured()) {
    return { error: "mailerOff" };
  }

  return neutral;
}

export async function resetPasswordAction(
  _prev: { ok?: string; error?: string } | null,
  fd: FormData,
): Promise<{ ok?: string; error?: string } | null> {
  const token = String(fd.get("token") ?? "");
  const next = String(fd.get("next") ?? "");
  const confirm = String(fd.get("confirm") ?? "");

  const fingerprint = await callerFingerprint();
  const limit = await rateLimit(`reset-use:${fingerprint}`, 10, 60 * 60 * 1000);
  if (!limit.ok) return { error: "tooMany" };

  // Keys, not sentences: the words belong to whichever language the visitor
  // chose, and an action has no business knowing which that is.
  const record = await findValidReset(token);
  if (!record) return { error: "badToken" };
  if (next.length < 8) return { error: "weak" };
  if (next !== confirm) return { error: "mismatch" };

  const user = await get<User>("SELECT * FROM users WHERE id = ?", record.user_id);
  if (!user) return { error: "failed" };

  await run(
    "UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?",
    hashPassword(next),
    now(),
    user.id,
  );
  await consumeReset(record.id);
  await revokeSessionsFor(user.id);

  await audit({
    actor: user,
    action: "account.password_reset_completed",
    targetType: "user",
    targetId: user.id,
    targetLabel: user.email,
    detail: (await messages()).sessionsEndedByReset,
  });

  await createSession(user.id);
  await adoptAccountLocale(user);
  redirect(user.role === "client" ? "/dashboard" : "/console");
}
