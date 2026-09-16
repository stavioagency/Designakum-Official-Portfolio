"use client";

import Link from "next/link";
import { useActionState } from "react";
import { PasswordField } from "@/components/password-field";
import type { Dictionary } from "@/lib/i18n";
import { requestPasswordResetAction, resetPasswordAction } from "@/app/actions/auth";
import { Field, Status, Submit } from "@/components/editor/ui";

type Copy = Dictionary["reset"];

/**
 * The actions answer with keys, not sentences, so the words live in the
 * dictionary and the same action serves both languages.
 */
function translate(state: { ok?: string; error?: string } | null, copy: Copy) {
  if (!state) return null;
  const say = (key?: string) =>
    key ? ((copy as unknown as Record<string, string>)[key] ?? key) : undefined;
  return { ok: say(state.ok), error: say(state.error) };
}

export function ForgotPasswordForm({ copy }: { copy: Copy }) {
  const [state, action] = useActionState(requestPasswordResetAction, null);

  return (
    <form action={action} className="space-y-4">
      <Field label={copy.email}>
        <input name="email" type="email" className="field" dir="ltr" required placeholder="you@studio.com" />
      </Field>
      <Status state={translate(state, copy)} sticky />
      <Submit className="btn btn-primary w-full" pendingLabel={copy.sending}>
        {copy.send}
      </Submit>
      <p className="text-center text-[13px] text-mist-400">
        {copy.remembered}{" "}
        <Link
          href="/login"
          className="font-semibold text-mist-50 underline decoration-white/25 underline-offset-4"
        >
          {copy.backToLogin}
        </Link>
      </p>
    </form>
  );
}

export function ResetPasswordForm({
  token,
  copy,
  passwordCopy,
}: {
  token: string;
  copy: Copy;
  passwordCopy: Dictionary["password"];
}) {
  const [state, action] = useActionState(resetPasswordAction, null);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <PasswordField name="next" label={copy.newPassword} copy={passwordCopy} />
      <Field label={copy.confirm}>
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
      <Status state={translate(state, copy)} sticky />
      <Submit className="btn btn-primary w-full" pendingLabel={copy.pending}>
        {copy.submit}
      </Submit>
    </form>
  );
}
