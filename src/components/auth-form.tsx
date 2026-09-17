"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import type { FormState } from "@/app/actions/auth";
import type { Dictionary } from "@/lib/i18n";
import { PasswordField } from "@/components/password-field";

function Submit({ label, pending: pendingLabel }: { label: string; pending: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn-primary w-full" disabled={pending}>
      {pending ? pendingLabel : label}
    </button>
  );
}

function GoogleGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="19" height="19" aria-hidden>
      <path fill="#4285F4" d="M23 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.17a5.28 5.28 0 0 1-2.29 3.46v2.88h3.7C21.74 18.8 23 15.8 23 12.27Z" />
      <path fill="#34A853" d="M12 23.5c3.1 0 5.7-1.03 7.59-2.79l-3.7-2.88c-1.03.69-2.35 1.1-3.89 1.1-2.99 0-5.53-2.02-6.43-4.74H1.74v2.97A11.5 11.5 0 0 0 12 23.5Z" />
      <path fill="#FBBC05" d="M5.57 14.19a6.9 6.9 0 0 1 0-4.38V6.84H1.74a11.5 11.5 0 0 0 0 10.32l3.83-2.97Z" />
      <path fill="#EA4335" d="M12 5.07c1.69 0 3.2.58 4.39 1.72l3.28-3.28C17.7 1.63 15.1.5 12 .5 7.52.5 3.65 3.08 1.74 6.84l3.83 2.97C6.47 7.09 9.01 5.07 12 5.07Z" />
    </svg>
  );
}

export function AuthForm({
  mode,
  action,
  d,
  errors,
  googleReady,
  initialError,
  inviteCode,
  wantedSlug,
  inviteRequired,
  passwordCopy,
}: {
  mode: "login" | "signup";
  action: (prev: FormState, fd: FormData) => Promise<FormState>;
  d: Dictionary["auth"];
  errors: Dictionary["authErrors"];
  passwordCopy: Dictionary["password"];
  googleReady: boolean;
  initialError?: string;
  inviteCode?: string;
  /** The link typed on the landing page, carried through to /welcome. */
  wantedSlug?: string;
  inviteRequired?: boolean;
}) {
  const [state, formAction] = useActionState(action, null);
  const isSignup = mode === "signup";

  const errorKey = state?.error ?? initialError;
  const message = errorKey
    ? (errors as Record<string, string>)[errorKey] ?? errorKey
    : null;

  return (
    <div className="space-y-5">
      {googleReady ? (
        <a
          href={`/api/auth/google?returnTo=${encodeURIComponent("/dashboard")}`}
          className="btn btn-ghost w-full !bg-white !text-[#1f1f1f] hover:!bg-white/90"
        >
          <GoogleGlyph />
          {d.google}
        </a>
      ) : (
        <p className="panel px-4 py-3 text-center text-[12px] leading-relaxed text-mist-500">
          {d.googleDisabled}
        </p>
      )}

      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-white/10" />
        <span className="text-[11.5px] text-mist-500">{d.or}</span>
        <span className="h-px flex-1 bg-white/10" />
      </div>

      <form action={formAction} className="space-y-4">
        {isSignup && (
          <>
            <div>
              <label className="label" htmlFor="name">{d.name}</label>
              <input id="name" name="name" className="field" placeholder={d.namePlaceholder} required />
            </div>
            {wantedSlug && <input type="hidden" name="wanted" value={wantedSlug} />}
            <div>
              <label className="label" htmlFor="invite">{d.invite}</label>
              <input
                id="invite"
                name="invite"
                className="field"
                dir="ltr"
                defaultValue={inviteCode ?? ""}
                required={inviteRequired}
                placeholder="ABCDE-FGHIJ"
              />
              {!inviteRequired && (
                <p className="mt-1.5 text-[11.5px] text-mist-500">{d.inviteHint}</p>
              )}
            </div>
          </>
        )}

        <div>
          <label className="label" htmlFor="email">{d.email}</label>
          <input id="email" name="email" type="email" className="field" dir="ltr" placeholder="you@studio.com" required />
        </div>

        {/* Signing up states the rules while you type; signing in must not —
            the rules may have tightened since an account was made, and telling
            someone their existing password is unacceptable helps nobody. */}
        {isSignup ? (
          <PasswordField name="password" label={d.password} copy={passwordCopy} />
        ) : (
          <div>
            <div className="flex items-baseline justify-between gap-2">
              <label className="label" htmlFor="password">{d.password}</label>
              <Link
                href="/forgot"
                className="mb-[7px] text-[11.5px] text-mist-500 transition hover:text-mist-300"
              >
                {d.forgot}
              </Link>
            </div>
            <input
              id="password"
              name="password"
              type="password"
              className="field"
              dir="ltr"
              placeholder="••••••••"
              autoComplete="current-password"
              required
            />
          </div>
        )}

        {message && (
          <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-[13px] text-rose-200">
            {message}
          </p>
        )}

        <Submit label={isSignup ? d.submitSignup : d.submitLogin} pending={d.pending} />
      </form>

      <p className="text-center text-[13px] text-mist-400">
        {isSignup ? d.haveAccount : d.noAccount}{" "}
        <Link
          href={isSignup ? "/login" : "/signup"}
          className="font-semibold text-mist-50 underline decoration-white/25 underline-offset-4 hover:decoration-white/60"
        >
          {isSignup ? d.toLogin : d.toSignup}
        </Link>
      </p>
    </div>
  );
}
