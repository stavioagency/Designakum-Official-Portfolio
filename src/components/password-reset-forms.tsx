"use client";

import Link from "next/link";
import { useActionState } from "react";
import { requestPasswordResetAction, resetPasswordAction } from "@/app/actions/auth";
import { Field, Status, Submit } from "@/components/editor/ui";

export function ForgotPasswordForm() {
  const [state, action] = useActionState(requestPasswordResetAction, null);

  return (
    <form action={action} className="space-y-4">
      <Field label="البريد الإلكتروني">
        <input name="email" type="email" className="field" dir="ltr" required placeholder="you@studio.com" />
      </Field>
      <Status state={state} />
      <Submit className="btn btn-primary w-full" pendingLabel="جارٍ الإرسال…">
        أرسل رابط الاستعادة
      </Submit>
      <p className="text-center text-[13px] text-mist-400">
        تذكّرتها؟{" "}
        <Link
          href="/login"
          className="font-semibold text-mist-50 underline decoration-white/25 underline-offset-4"
        >
          العودة لتسجيل الدخول
        </Link>
      </p>
    </form>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, action] = useActionState(resetPasswordAction, null);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <Field label="كلمة المرور الجديدة" hint="8 أحرف على الأقل.">
        <input
          name="next"
          type="password"
          className="field"
          dir="ltr"
          minLength={8}
          required
          autoComplete="new-password"
        />
      </Field>
      <Field label="تأكيد كلمة المرور">
        <input
          name="confirm"
          type="password"
          className="field"
          dir="ltr"
          minLength={8}
          required
          autoComplete="new-password"
        />
      </Field>
      <Status state={state} />
      <Submit className="btn btn-primary w-full" pendingLabel="لحظة…">
        تعيين كلمة المرور والدخول
      </Submit>
    </form>
  );
}
