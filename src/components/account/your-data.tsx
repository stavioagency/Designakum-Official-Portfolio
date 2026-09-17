"use client";

import { useActionState, useState } from "react";
import { deleteAccountAction } from "@/app/actions/auth";
import { Field, Status, Submit } from "@/components/editor/ui";
import { Download, AlertTriangle } from "@/components/icons";

/**
 * The two things a person is entitled to do with their own data: take a copy,
 * and make it stop existing.
 *
 * Deliberately one section, and deliberately last on the page. They belong
 * together — anyone about to do the second should be offered the first — and
 * neither is something to stumble into while changing a password.
 */
export function YourData({
  email,
  hasPassword,
  copy,
  saving,
}: {
  email: string;
  hasPassword: boolean;
  copy: {
    exportHeading: string;
    exportNote: string;
    exportCta: string;
    deleteHeading: string;
    deleteNote: string;
    deleteWarn: string;
    deleteConfirmLabel: string;
    deletePasswordLabel: string;
    deleteCta: string;
    deleteOpen: string;
    cancel: string;
  };
  saving: string;
}) {
  const [state, remove] = useActionState(deleteAccountAction, null);
  const [arming, setArming] = useState(false);

  return (
    <div className="space-y-5">
      <section className="card space-y-4 p-5 sm:p-6">
        <header>
          <h2 className="text-lg font-semibold">{copy.exportHeading}</h2>
          <p className="mt-1 text-[13px] leading-relaxed text-mist-400">{copy.exportNote}</p>
        </header>
        {/* A plain link, not a fetch: the browser's own download is what puts
            the file somewhere the person can actually find it again. */}
        <a href="/api/account/export" className="btn btn-ghost w-full sm:w-auto" download>
          <Download className="h-4 w-4" />
          {copy.exportCta}
        </a>
      </section>

      <section className="card space-y-4 border-rose-500/25 p-5 sm:p-6">
        <header>
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <AlertTriangle className="h-[18px] w-[18px] text-rose-300" />
            {copy.deleteHeading}
          </h2>
          <p className="mt-1 text-[13px] leading-relaxed text-mist-400">{copy.deleteNote}</p>
        </header>

        {!arming ? (
          <button
            type="button"
            onClick={() => setArming(true)}
            className="btn btn-ghost w-full border-rose-500/30 text-rose-200 sm:w-auto"
          >
            {copy.deleteOpen}
          </button>
        ) : (
          <form action={remove} className="space-y-4">
            <p className="rounded-xl bg-rose-500/[0.08] px-4 py-3 text-[13px] leading-relaxed text-rose-200">
              {copy.deleteWarn}
            </p>

            {/* Their own address, typed. A checkbox is something a person
                clicks past; typing this is a moment where they have to know
                what they are about to do. */}
            <Field label={copy.deleteConfirmLabel}>
              <input
                name="confirmEmail"
                type="email"
                className="field"
                dir="ltr"
                autoComplete="off"
                placeholder={email}
                required
              />
            </Field>

            {hasPassword && (
              <Field label={copy.deletePasswordLabel}>
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
              <Submit className="btn btn-danger" pendingLabel={saving}>
                {copy.deleteCta}
              </Submit>
              <button
                type="button"
                onClick={() => setArming(false)}
                className="text-[13px] text-mist-400 underline underline-offset-4 hover:text-mist-200"
              >
                {copy.cancel}
              </button>
              <Status state={state} sticky />
            </div>
          </form>
        )}
      </section>
    </div>
  );
}
