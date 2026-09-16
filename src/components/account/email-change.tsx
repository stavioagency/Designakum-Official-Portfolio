"use client";

import { useActionState } from "react";
import { requestEmailChangeAction } from "@/app/actions/auth";
import { Field, Status, Submit } from "@/components/editor/ui";
import type { Dictionary } from "@/lib/i18n";

/**
 * Asks for a new address; never sets one.
 *
 * The account is untouched until a link sent to the new address is opened, so
 * the form's success message has to say where to look — which is why the status
 * is sticky rather than fading after four seconds.
 */
export function EmailChange({
  currentEmail,
  hasPassword,
  usesGoogle,
  t,
  saving,
}: {
  currentEmail: string;
  hasPassword: boolean;
  usesGoogle: boolean;
  t: Dictionary["dashboard"]["settings"];
  saving: string;
}) {
  const [state, request] = useActionState(requestEmailChangeAction, null);

  return (
    <section className="card space-y-4 p-5 sm:p-6">
      <header>
        <h2 className="text-lg font-semibold">{t.changeEmail}</h2>
        <p className="mt-1 text-[13px] leading-relaxed text-mist-400">{t.changeEmailNote}</p>
      </header>

      <p className="rounded-xl bg-white/[0.035] px-3.5 py-2.5 text-[13.5px] text-mist-300" dir="ltr">
        {currentEmail}
      </p>

      <form action={request} className="space-y-4">
        <Field label={t.newEmail}>
          <input
            name="email"
            type="email"
            className="field"
            dir="ltr"
            required
            autoComplete="email"
          />
        </Field>

        {hasPassword && (
          <Field label={t.currentPassword}>
            <input
              name="current"
              type="password"
              className="field"
              dir="ltr"
              required
              autoComplete="current-password"
            />
          </Field>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <Submit pendingLabel={saving}>{t.changeEmail}</Submit>
          <Status state={state} sticky />
        </div>
      </form>

      {usesGoogle && (
        <p className="text-[12px] leading-relaxed text-mist-500">{t.changeEmailGoogleNote}</p>
      )}
    </section>
  );
}
