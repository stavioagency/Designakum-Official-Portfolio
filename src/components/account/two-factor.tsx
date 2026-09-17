"use client";

import { useActionState, useState } from "react";
import { disableTwoFactorAction, enableTwoFactorAction } from "@/app/actions/auth";
import { Field, Status, Submit } from "@/components/editor/ui";
import { Shield } from "@/components/icons";
import type { Dictionary } from "@/lib/i18n";

/**
 * Turning on two-step verification, and the one moment the recovery codes
 * exist on screen.
 *
 * The codes are returned by the action and rendered here rather than stored
 * anywhere readable, so this is genuinely the only time they can be copied.
 * That is the point — but it also means this component must not lose them to a
 * re-render, which is why they live in the action's own returned state.
 */
export function TwoFactor({
  enabled,
  hasPassword,
  codesLeft,
  secret,
  qrSvg,
  copy,
  saving,
}: {
  enabled: boolean;
  hasPassword: boolean;
  codesLeft: number;
  /** A fresh secret, generated per page load and only stored if enrolment succeeds. */
  secret: string;
  qrSvg: string;
  copy: Dictionary["twoFactor"];
  saving: string;
}) {
  const [enableState, enable] = useActionState(enableTwoFactorAction, null);
  const [disableState, disable] = useActionState(disableTwoFactorAction, null);
  const [arming, setArming] = useState(false);

  const codes = enableState?.codes;

  return (
    <section className="card space-y-4 p-5 sm:p-6">
      <header>
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Shield className="h-[18px] w-[18px]" style={{ color: "var(--accent-ring)" }} />
          {copy.heading}
          <span
            className={`rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold ${
              enabled ? "bg-emerald-400/12 text-emerald-300" : "bg-white/[0.07] text-mist-400"
            }`}
          >
            {enabled ? copy.on : copy.off}
          </span>
        </h2>
        <p className="mt-1 text-[13px] leading-relaxed text-mist-400">{copy.note}</p>
      </header>

      {codes && (
        <div className="rounded-2xl border border-amber-400/25 bg-amber-400/[0.07] p-4">
          <p className="text-[13.5px] font-semibold text-amber-200">{copy.recoveryTitle}</p>
          <p className="mt-1 text-[12.5px] leading-relaxed text-amber-200/80">
            {copy.recoveryNote}
          </p>
          <ul className="mt-3 grid gap-1.5 sm:grid-cols-2" dir="ltr">
            {codes.map((code) => (
              <li
                key={code}
                className="rounded-lg bg-black/25 px-3 py-1.5 font-mono text-[13px] tracking-wider text-amber-100"
              >
                {code}
              </li>
            ))}
          </ul>
        </div>
      )}

      {enabled ? (
        <form action={disable} className="space-y-3">
          <p className="text-[12.5px] text-mist-500">
            {copy.recoveryLeft.replace("{n}", String(codesLeft))}
          </p>
          {hasPassword && (
            <Field label={copy.confirmPassword}>
              <input
                name="password"
                type="password"
                className="field"
                dir="ltr"
                autoComplete="current-password"
                required
              />
            </Field>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <Submit className="btn btn-ghost" pendingLabel={saving}>
              {copy.turnOff}
            </Submit>
            <Status state={disableState} />
          </div>
        </form>
      ) : !arming ? (
        <button type="button" onClick={() => setArming(true)} className="btn btn-primary">
          {copy.turnOn}
        </button>
      ) : (
        <form action={enable} className="space-y-4">
          <input type="hidden" name="secret" value={secret} />
          <p className="text-[13px] leading-relaxed text-mist-300">{copy.scan}</p>

          <div className="flex flex-wrap items-start gap-5">
            <div
              className="h-[164px] w-[164px] shrink-0 overflow-hidden rounded-2xl bg-white p-2"
              dangerouslySetInnerHTML={{ __html: qrSvg }}
            />
            <div className="min-w-0 flex-1 space-y-3">
              <div>
                <p className="text-[12px] text-mist-500">{copy.manual}</p>
                <code className="mt-1 block break-all rounded-lg bg-white/[0.05] px-3 py-2 text-[12.5px] tracking-wider" dir="ltr">
                  {secret}
                </code>
              </div>
              <Field label={copy.codeLabel}>
                <input
                  name="code"
                  autoComplete="one-time-code"
                  inputMode="numeric"
                  required
                  dir="ltr"
                  placeholder="000000"
                  className="field text-center tracking-[0.3em]"
                />
              </Field>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Submit pendingLabel={saving}>{copy.turnOn}</Submit>
            <button
              type="button"
              onClick={() => setArming(false)}
              className="text-[13px] text-mist-400 underline underline-offset-4 hover:text-mist-200"
            >
              {copy.off}
            </button>
            <Status state={enableState} sticky />
          </div>
        </form>
      )}
    </section>
  );
}
