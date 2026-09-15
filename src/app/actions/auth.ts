"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  createSession,
  destroySession,
  findUserByEmail,
  hashPassword,
  requireUser,
  revokeSessionsFor,
  verifyPassword,
} from "@/lib/auth";
import { audit } from "@/lib/audit";
import { now, run } from "@/lib/db";
import { provisionClient } from "@/lib/provision";
import { slugify } from "@/lib/ids";
import { LOCALE_COOKIE } from "@/lib/locale";
import { isLocale } from "@/lib/i18n";
import { readSettings } from "@/lib/settings";
import { checkInvitation, redeemInvitation } from "@/lib/invitations";
import { callerFingerprint, rateLimit } from "@/lib/rate-limit";
import { consumeReset, createPasswordReset, findValidReset } from "@/lib/password-reset";
import { emailConfigured, sendMail } from "@/lib/mailer";
import { requestOrigin } from "@/lib/origin";
import { get } from "@/lib/db";
import type { User } from "@/lib/types";

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
  const signups = rateLimit(`signup:${fingerprint}`, 3, 60 * 60 * 1000);
  if (!signups.ok) return { error: "too_many_signups" };

  const settings = readSettings();
  const inviteCode = str(fd, "invite");

  // An invitation is what reopens a closed or invite-only platform.
  const invitation = inviteCode ? checkInvitation(inviteCode, email) : null;
  const hasValidInvite = Boolean(invitation && "invitation" in invitation);

  if (invitation && "problem" in invitation) return { error: `invite_${invitation.problem}` };
  if (!settings["platform.signups_open"] && !hasValidInvite) return { error: "signups_closed" };
  if (settings["platform.invite_only"] && !hasValidInvite) return { error: "invite_required" };

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: "invalid_email" };
  if (password.length < 8) return { error: "weak_password" };
  if (name.length < 2) return { error: "short_name" };
  if (!slugify(desiredSlug)) return { error: "bad_slug" };
  if (findUserByEmail(email)) return { error: "email_taken" };

  const { user } = provisionClient({ email, password, name, title, slug: desiredSlug });
  if (invitation && "invitation" in invitation) redeemInvitation(invitation.invitation, user);

  await createSession(user.id);

  redirect("/dashboard");
}

export async function loginAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const email = str(fd, "email").toLowerCase();
  const password = String(fd.get("password") ?? "");

  // Throttle password guessing per caller and per account.
  const fingerprint = await callerFingerprint();
  const attempts = rateLimit(`login:${fingerprint}:${email}`, 8, 15 * 60 * 1000);
  if (!attempts.ok) return { error: "too_many_attempts" };

  const user = findUserByEmail(email);
  if (!user || !verifyPassword(password, user.password_hash)) {
    return { error: "bad_credentials" };
  }
  if (user.status === "suspended") {
    return { error: "suspended" };
  }

  await createSession(user.id);
  redirect(user.role === "client" ? "/dashboard" : "/console");
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}

/** Switches the interface language and reloads whatever page the visitor is on. */
export async function setLocaleAction(fd: FormData) {
  const locale = String(fd.get("locale") ?? "");
  const path = String(fd.get("path") ?? "/");

  if (isLocale(locale)) {
    (await cookies()).set(LOCALE_COOKIE, locale, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
    });
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
      return { error: "كلمة المرور الحالية غير صحيحة" };
    }
    if (next.length < 8) return { error: "كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل" };
    if (next !== confirm) return { error: "كلمتا المرور غير متطابقتين" };
    if (hasPassword && next === current) return { error: "اختر كلمة مرور مختلفة عن الحالية" };

    run(
      "UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?",
      hashPassword(next),
      now(),
      user.id,
    );

    // Drop every session, including this one, then re-issue for this browser.
    revokeSessionsFor(user.id);
    await createSession(user.id);

    audit({
      actor: user,
      action: hasPassword ? "account.password_changed" : "account.password_set",
      targetType: "user",
      targetId: user.id,
      targetLabel: user.email,
      detail: "بواسطة صاحب الحساب — أُنهيت بقية الجلسات",
    });

    return {
      ok: hasPassword
        ? "تم تغيير كلمة المرور وإنهاء الجلسات الأخرى"
        : "تم تعيين كلمة المرور، ويمكنك الآن الدخول بالبريد وكلمة المرور",
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "تعذّر تغيير كلمة المرور" };
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
  const limit = rateLimit(`reset:${fingerprint}`, 5, 60 * 60 * 1000);
  if (!limit.ok) return { error: "too_many_attempts" };

  const neutral = {
    ok: "إن كان هذا البريد مسجّلاً لدينا فسيصلك رابط لإعادة تعيين كلمة المرور خلال دقائق.",
  };

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return neutral;

  const user = findUserByEmail(email);
  if (!user || user.status === "suspended") return neutral;

  const token = createPasswordReset(user);
  const origin = await requestOrigin();
  const link = `${origin}/reset/${token}`;

  const result = await sendMail({
    to: user.email,
    subject: "إعادة تعيين كلمة المرور — ديزاينكم",
    kind: "password_reset",
    body: [
      `مرحبًا ${user.display_name || ""}`.trim(),
      "",
      "وصلنا طلب لإعادة تعيين كلمة مرور حسابك في ديزاينكم.",
      "افتح الرابط التالي خلال ساعة واحدة لتعيين كلمة مرور جديدة:",
      link,
      "",
      "إن لم تطلب ذلك فتجاهل هذه الرسالة، ولن يتغيّر شيء في حسابك.",
    ].join("\n"),
  });

  // Without a mail provider the link cannot reach anyone, and saying otherwise
  // would leave the customer waiting for an email that will never arrive.
  if (!result.delivered && !emailConfigured()) {
    return {
      error:
        "خدمة البريد غير مفعّلة على هذه النسخة بعد، لذلك لا يمكن إرسال رابط الاستعادة. تواصل مع إدارة المنصة لإعادة تعيين كلمة مرورك.",
    };
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
  const limit = rateLimit(`reset-use:${fingerprint}`, 10, 60 * 60 * 1000);
  if (!limit.ok) return { error: "too_many_attempts" };

  const record = findValidReset(token);
  if (!record) return { error: "انتهت صلاحية الرابط أو سبق استخدامه. اطلب رابطًا جديدًا." };
  if (next.length < 8) return { error: "كلمة المرور يجب أن تكون 8 أحرف على الأقل" };
  if (next !== confirm) return { error: "كلمتا المرور غير متطابقتين" };

  const user = get<User>("SELECT * FROM users WHERE id = ?", record.user_id);
  if (!user) return { error: "الحساب غير موجود" };

  run(
    "UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?",
    hashPassword(next),
    now(),
    user.id,
  );
  consumeReset(record.id);
  revokeSessionsFor(user.id);

  audit({
    actor: user,
    action: "account.password_reset_completed",
    targetType: "user",
    targetId: user.id,
    targetLabel: user.email,
    detail: "عبر رابط استعادة — أُنهيت كل الجلسات",
  });

  await createSession(user.id);
  redirect(user.role === "client" ? "/dashboard" : "/console");
}
