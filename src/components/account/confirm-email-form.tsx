"use client";

import { useActionState } from "react";
import Link from "next/link";
import { confirmEmailChangeAction } from "@/app/actions/auth";
import type { Dictionary } from "@/lib/i18n";

/**
 * A button, not an automatic confirmation.
 *
 * The link that leads here arrives by email, and mail clients and security
 * scanners follow links in messages to check them. Adopting the address on the
 * GET would let a scanner confirm the change before the person ever saw it, so
 * the change happens on a POST that a human has to press.
 */
export function ConfirmEmailForm({
  token,
  newEmail,
  copy,
}: {
  token: string;
  newEmail: string;
  copy: Dictionary["emailChange"];
}) {
  const [state, confirm, pending] = useActionState(confirmEmailChangeAction, null);

  if (state?.ok) {
    return (
      <div className="text-center">
        <p className="text-[15px] leading-relaxed text-mist-300">{state.ok}</p>
        <Link href="/login" className="btn btn-primary mt-6 w-full">
          {copy.signInAgain}
        </Link>
      </div>
    );
  }

  return (
    <form action={confirm} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <p className="rounded-2xl bg-white/[0.04] px-4 py-3 text-center text-[15px] font-semibold" dir="ltr">
        {newEmail}
      </p>
      <button type="submit" className="btn btn-primary w-full" disabled={pending}>
        {pending ? copy.pending : copy.confirm}
      </button>
      {state?.error && (
        <p className="text-center text-[13px] leading-relaxed text-rose-300">{state.error}</p>
      )}
    </form>
  );
}
