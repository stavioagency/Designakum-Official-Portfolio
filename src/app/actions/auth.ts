"use server";

import { cookies } from "next/headers";
import { messages } from "@/lib/locale";
import { dict, fill } from "@/lib/i18n";
import { redirect } from "next/navigation";
import {
  clearSecondFactor,
  createSession,
  currentUser,
  pendingSecondFactor,
  startSecondFactor,
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
import { LOCALE_COOKIE, currentLocale, localeCookieOptions } from "@/lib/locale";
import { isLocale } from "@/lib/i18n";
import { readSettings } from "@/lib/settings";
import { passwordAcceptable } from "@/lib/password-policy";
import { checkInvitation, redeemInvitation } from "@/lib/invitations";
import { callerFingerprint, rateLimit } from "@/lib/rate-limit";
import { consumeReset, createPasswordReset, findValidReset } from "@/lib/password-reset";
import {
  cancelPendingEmailChanges,
  consumeEmailChange,
  createEmailChange,
  emailTaken,
  findValidEmailChange,
} from "@/lib/email-change";
import { emailConfigured, sendMail } from "@/lib/mailer";
import { emailTemplate } from "@/lib/emails";
import { accountRemnants, deleteAccount } from "@/lib/account-data";
import * as twoFactor from "@/lib/two-factor";
import { isEnabled, verifySecondFactor } from "@/lib/two-factor";
import { requestOrigin } from "@/lib/origin";
import { get } from "@/lib/db";
import { reportError } from "@/lib/observability";
import type { User } from "@/lib/types";

/** `error` is a key into the `authErrors` dictionary, so it can be shown in either language. */
export type FormState = { error?: string } | null;

const str = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();

export async function signupAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const email = str(fd, "email").toLowerCase();
  const password = String(fd.get("password") ?? "");
  const name = str(fd, "name");

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
  if (!passwordAcceptable(password)) return { error: "weak_password" };
  if (name.length < 2) return { error: "short_name" };
  if (await findUserByEmail(email)) return { error: "email_taken" };

  // Whatever they picked at the gate is the account's language from here on:
  // starter copy, dashboard, and every email we ever send them.
  const locale = await currentLocale();
  const { user } = await provisionClient({
    email,
    password,
    name,
    locale,
    chooseOwnLink: true,
  });
  if (invitation && "invitation" in invitation) await redeemInvitation(invitation.invitation, user);

  await createSession(user.id);

  /**
   * The link is chosen on /welcome, not on this form — see src/lib/onboarding.ts
   * for why both sign-up routes converge there. A name typed into the landing
   * page rides along as a suggestion, and is checked there, with an account
   * behind the question: the availability endpoint refuses anonymous callers so
   * that box cannot be used to enumerate customers.
   */
  const wanted = slugify(str(fd, "wanted"));
  redirect(wanted ? `/welcome?slug=${encodeURIComponent(wanted)}` : "/welcome");
}

export async function loginAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const email = str(fd, "email").toLowerCase();
  const password = String(fd.get("password") ?? "");

  /**
   * Three limits, because one key cannot describe all three attacks.
   *
   * The pair catches someone working on a single account from a single place.
   * It does not catch spraying — one common password tried against a thousand
   * different emails — because every new email starts a fresh counter, so the
   * caller alone is counted too. And it does not catch a distributed attempt on
   * one account, where every attacker looks new, so the account is counted as
   * well.
   *
   * The per-account limit is the loosest of the three on purpose: it is the one
   * a stranger could use to lock a real customer out, and these windows expire
   * rather than latching.
   */
  const fingerprint = await callerFingerprint();

  const pair = await rateLimit(`login:${fingerprint}:${email}`, 8, 15 * 60 * 1000);
  if (!pair.ok) return { error: "too_many_attempts" };

  const caller = await rateLimit(`login-caller:${fingerprint}`, 20, 15 * 60 * 1000);
  if (!caller.ok) return { error: "too_many_attempts" };

  const account = await rateLimit(`login-account:${email}`, 30, 60 * 60 * 1000);
  if (!account.ok) return { error: "too_many_attempts" };

  const user = await findUserByEmail(email);
  if (!user || !verifyPassword(password, user.password_hash)) {
    return { error: "bad_credentials" };
  }
  if (user.status === "suspended") {
    return { error: "suspended" };
  }

  // A correct password is not a session when a second factor is on. No session
  // is created here at all — the half-signed-in state is a short-lived signed
  // cookie, so nothing downstream has to know about a session that is not yet
  // allowed to do anything.
  if (isEnabled(user)) {
    await startSecondFactor(user.id);
    redirect("/login/verify");
  }

  await createSession(user.id);
  await adoptAccountLocale(user);
  redirect(user.role === "client" ? "/dashboard" : "/console");
}

/**
 * The second step: six digits from the app, or one recovery code.
 *
 * Rate limited hard. Six digits is a million combinations, which sounds like a
 * lot until something tries them at machine speed against a window that is
 * ninety seconds wide.
 */
export async function verifySecondFactorAction(
  _prev: FormState,
  fd: FormData,
): Promise<FormState> {
  const user = await pendingSecondFactor();
  if (!user) return { error: "two_factor_expired" };

  const fingerprint = await callerFingerprint();
  const limit = await rateLimit(`2fa:${user.id}`, 10, 15 * 60 * 1000);
  const caller = await rateLimit(`2fa-caller:${fingerprint}`, 20, 15 * 60 * 1000);
  if (!limit.ok || !caller.ok) return { error: "too_many_attempts" };

  if (!(await verifySecondFactor(user, String(fd.get("code") ?? "")))) {
    return { error: "two_factor_bad_code" };
  }

  await clearSecondFactor();
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
  (await cookies()).set(LOCALE_COOKIE, user.locale, localeCookieOptions);
}

/** Switches the interface language and reloads whatever page the visitor is on. */
export async function setLocaleAction(fd: FormData) {
  const locale = String(fd.get("locale") ?? "");
  const path = String(fd.get("path") ?? "/");

  if (isLocale(locale)) {
    (await cookies()).set(LOCALE_COOKIE, locale, localeCookieOptions);

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
    if (!passwordAcceptable(next)) return { error: (await messages()).weakPassword };
    if (next !== confirm) return { error: (await messages()).passwordMismatch };
    if (hasPassword && next === current) return { error: (await messages()).samePassword };

    await run(
      "UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?",
      hashPassword(next),
      now(),
      user.id,
    );

    // The notice sent to the old address says changing the password cancels a
    // pending email change. Make that true before anything else.
    await cancelPendingEmailChanges(user.id);

    // Drop every session, including this one, then re-issue for this browser.
    await revokeSessionsFor(user.id);
    await createSession(user.id);

    // Tell them it happened. This is the message that surfaces an account
    // takeover, so a failure to send must not fail the change itself — the
    // password is already rotated and the sessions already gone.
    try {
      const origin = await requestOrigin();
      const composed = emailTemplate.passwordChanged(user.locale, {
        name: user.display_name || "",
        resetUrl: `${origin}/forgot`,
      });
      await sendMail({ to: user.email, kind: "password_changed", ...composed });
    } catch (error) {
      reportError(error, { area: "password-changed-email", userId: user.id });
    }

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


/* -------------------------------------------------------------- two factor */

/**
 * Turns it on, but only once a code from the app has been checked.
 *
 * The secret is not written until that check passes. An account that pairs
 * badly and walks away leaves nothing behind to trip over at the next sign-in,
 * which for the last owner would mean losing the platform to a typo.
 */
export async function enableTwoFactorAction(
  _prev: { ok?: string; error?: string; codes?: string[] } | null,
  fd: FormData,
): Promise<{ ok?: string; error?: string; codes?: string[] } | null> {
  const d = dict(await currentLocale()).twoFactor;
  try {
    const user = await requireUser();
    const secret = String(fd.get("secret") ?? "");
    const code = String(fd.get("code") ?? "");

    const result = await twoFactor.enable(user, secret, code);
    if (!result.ok) return { error: d.badCode };

    await audit({
      actor: user,
      action: "account.two_factor_enabled",
      targetType: "user",
      targetId: user.id,
      targetLabel: user.email,
    });

    // Returned once, shown once. There is no second chance to read them.
    return { ok: d.enabled, codes: result.recoveryCodes };
  } catch (error) {
    reportError(error, { area: "two-factor-enable" });
    return { error: (await messages()).failed };
  }
}

export async function disableTwoFactorAction(
  _prev: { ok?: string; error?: string } | null,
  fd: FormData,
): Promise<{ ok?: string; error?: string } | null> {
  const d = dict(await currentLocale()).twoFactor;
  try {
    const user = await requireUser();

    // Their password, to turn off the thing guarding the password. Without it,
    // an unlocked laptop is enough to remove the second factor entirely.
    if (user.password_hash !== "") {
      if (!verifyPassword(String(fd.get("password") ?? ""), user.password_hash)) {
        return { error: (await messages()).wrongCurrentPassword };
      }
    }

    await twoFactor.disable(user);
    await audit({
      actor: user,
      action: "account.two_factor_disabled",
      targetType: "user",
      targetId: user.id,
      targetLabel: user.email,
    });
    return { ok: d.disabled };
  } catch (error) {
    reportError(error, { area: "two-factor-disable" });
    return { error: (await messages()).failed };
  }
}

/* ----------------------------------------------------------- deleting an account */

/**
 * Erases the account, on the customer's own say-so.
 *
 * Confirmation is their own email address typed out, not a checkbox. The action
 * is irreversible and takes their published page down with it, and a checkbox
 * is something a person clicks past; typing the address is a moment where they
 * have to know what they are doing. An account with a password must also give
 * it, because someone who walks up to an unlocked laptop should not be able to
 * end the account from the settings page.
 */
export async function deleteAccountAction(
  _prev: { ok?: string; error?: string } | null,
  fd: FormData,
): Promise<{ ok?: string; error?: string } | null> {
  const m = await messages();
  try {
    const user = await requireUser();

    // The last owner cannot delete themselves out of the platform: there would
    // be nobody able to reach the console afterwards, including to undo it.
    if (user.role === "owner") {
      const owners = await get<{ n: number }>(
        "SELECT COUNT(*) AS n FROM users WHERE role = 'owner' AND status = 'active'",
      );
      if ((owners?.n ?? 0) <= 1) return { error: m.lastOwner };
    }

    const typed = String(fd.get("confirmEmail") ?? "").trim().toLowerCase();
    if (typed !== user.email.trim().toLowerCase()) return { error: m.deleteEmailMismatch };

    if (user.password_hash !== "") {
      const password = String(fd.get("password") ?? "");
      if (!verifyPassword(password, user.password_hash)) {
        return { error: m.wrongCurrentPassword };
      }
    }

    const report = await deleteAccount(user);

    // Checked rather than assumed: the cascade is a promise the schema makes,
    // and this is the one operation where a promise that quietly failed would
    // leave someone's data behind after they were told it was gone.
    const left = await accountRemnants(user.id, user.email);
    if (left > 0) {
      reportError(new Error(`account ${user.id} left ${left} rows behind`), {
        area: "account-delete",
      });
    }

    reportError(new Error("account deleted"), {
      area: "account-delete",
      level: "info",
      files: report.files,
      mail: report.mail,
      auditEntries: report.auditEntries,
    });
  } catch (error) {
    reportError(error, { area: "account-delete" });
    return { error: error instanceof Error ? error.message : m.deleteFailed };
  }

  // Outside the try: redirect() throws by design, and catching it here would
  // turn a successful deletion into an error message on a page that no longer
  // has an account behind it.
  redirect("/?farewell=1");
}

/* -------------------------------------------------------------- email change */

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/**
 * Starts a move to a new address. Nothing is written to the account here.
 *
 * Two messages go out: a link to the new address, which is the only way to
 * prove it, and a warning to the old one, which is the only thing that reaches
 * someone whose account is being taken from them while they can still act.
 */
export async function requestEmailChangeAction(
  _prev: { ok?: string; error?: string } | null,
  fd: FormData,
): Promise<{ ok?: string; error?: string } | null> {
  const m = await messages();
  try {
    const user = await requireUser();

    // Per account, not per caller: the limit that matters is how often one
    // inbox can be made to receive these, and the account is what picks it.
    const limit = await rateLimit(`email-change:${user.id}`, 3, 60 * 60 * 1000);
    if (!limit.ok) return { error: m.tooManyAttempts };

    const newEmail = String(fd.get("email") ?? "").trim().toLowerCase();
    const current = String(fd.get("current") ?? "");

    if (!EMAIL_RE.test(newEmail)) return { error: m.emailInvalid };
    if (newEmail === user.email.trim().toLowerCase()) return { error: m.emailSameAsCurrent };

    // An account that has a password must prove it. One signed in with Google
    // has none to check, and the link to the new address is the proof instead.
    if (user.password_hash !== "" && !verifyPassword(current, user.password_hash)) {
      return { error: m.wrongCurrentPassword };
    }

    if (await emailTaken(newEmail, user.id)) return { error: m.emailTaken };

    const token = await createEmailChange(user, newEmail);
    const origin = await requestOrigin();

    const verify = emailTemplate.emailChangeVerify(user.locale, {
      name: user.display_name || "",
      link: `${origin}/email/${token}`,
      newEmail,
    });
    const sent = await sendMail({ to: newEmail, kind: "email_change_verify", ...verify });

    // Without a provider the link cannot reach anyone, and the address would sit
    // pending forever while the customer waited for a message that never comes.
    if (!sent.delivered && !emailConfigured()) return { error: m.emailChangeMailerOff };

    // Best effort, and never fatal: the move is already pending either way, and
    // failing the request here would leave a live token with nobody warned.
    try {
      const notice = emailTemplate.emailChangeNotice(user.locale, {
        name: user.display_name || "",
        newEmail,
        resetUrl: `${origin}/forgot`,
      });
      await sendMail({ to: user.email, kind: "email_change_notice", ...notice });
    } catch (error) {
      reportError(error, { area: "email-change-notice", userId: user.id });
    }

    await audit({
      actor: user,
      action: "account.email_change_requested",
      targetType: "user",
      targetId: user.id,
      targetLabel: user.email,
      detail: newEmail,
    });

    return { ok: m.emailChangeSent };
  } catch (error) {
    reportError(error, { area: "email-change-request" });
    return { error: error instanceof Error ? error.message : m.emailChangeFailed };
  }
}

/**
 * Adopts the address, on a POST from the confirmation page rather than on the
 * link itself: mail clients and security scanners follow links in messages, and
 * a GET that mutates would be confirmed by a robot before the person saw it.
 */
export async function confirmEmailChangeAction(
  _prev: { ok?: string; error?: string } | null,
  fd: FormData,
): Promise<{ ok?: string; error?: string } | null> {
  const m = await messages();
  try {
    const token = String(fd.get("token") ?? "");

    const fingerprint = await callerFingerprint();
    const limit = await rateLimit(`email-change-use:${fingerprint}`, 10, 60 * 60 * 1000);
    if (!limit.ok) return { error: m.tooManyAttempts };

    const record = await findValidEmailChange(token);
    if (!record) return { error: m.emailChangeBadToken };

    const user = await get<User>("SELECT * FROM users WHERE id = ?", record.user_id);
    if (!user) return { error: m.emailChangeFailed };

    // Checked again here, not only at request time: another account can have
    // taken the address during the half hour this token was valid.
    if (await emailTaken(record.new_email, user.id)) return { error: m.emailTaken };

    await run(
      "UPDATE users SET email = ?, email_verified_at = ?, updated_at = ? WHERE id = ?",
      record.new_email,
      now(),
      now(),
      user.id,
    );
    await consumeEmailChange(record.id);

    // Every session ends, including any the person who asked for this was
    // holding. Signing in again with the new address is the proof it worked.
    await revokeSessionsFor(user.id);

    try {
      const composed = emailTemplate.emailChanged(user.locale, {
        name: user.display_name || "",
        newEmail: record.new_email,
      });
      await sendMail({ to: record.new_email, kind: "email_changed", ...composed });
    } catch (error) {
      reportError(error, { area: "email-changed-email", userId: user.id });
    }

    await audit({
      actor: user,
      action: "account.email_changed",
      targetType: "user",
      targetId: user.id,
      targetLabel: record.new_email,
      detail: user.email,
    });

    return { ok: m.emailChangeDone };
  } catch (error) {
    reportError(error, { area: "email-change-confirm" });
    return { error: error instanceof Error ? error.message : m.emailChangeFailed };
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

  const result = await sendMail({ to: user.email, kind: "password_reset", ...composed });

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
  if (!passwordAcceptable(next)) return { error: "weak" };
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
