"use client";

import { useActionState } from "react";
import { verifySecondFactorAction } from "@/app/actions/auth";
import { Submit } from "@/components/editor/ui";
import type { Dictionary } from "@/lib/i18n";

export function SecondFactorForm({
  copy,
  errors,
}: {
  copy: Dictionary["twoFactor"];
  errors: Record<string, string>;
}) {
  const [state, verify] = useActionState(verifySecondFactorAction, null);

  return (
    <form action={verify} className="space-y-4">
      <input
        name="code"
        // `one-time-code` is what makes a phone offer the code from its own
        // notification, which is the difference between typing six digits and
        // tapping once.
        autoComplete="one-time-code"
        inputMode="text"
        autoFocus
        required
        dir="ltr"
        placeholder="000000"
        className="field text-center text-[19px] tracking-[0.3em]"
      />
      <Submit className="btn btn-primary w-full" pendingLabel={copy.checking}>
        {copy.verify}
      </Submit>
      {state?.error && (
        <p className="text-center text-[13px] leading-relaxed text-rose-300">
          {errors[state.error] ?? errors.failed}
        </p>
      )}
      <p className="text-center text-[12.5px] leading-relaxed text-mist-500">{copy.recoveryHint}</p>
    </form>
  );
}
