"use client";

import { useActionState, useState } from "react";
import { submitReportAction } from "@/app/actions/moderation";
import { Field, Status, Submit } from "@/components/editor/ui";
import { Flag, X } from "@/components/icons";
import { REPORT_REASONS } from "@/lib/types";
import { fill, type Dictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/types";
import { Modal } from "@/components/ui/modal";

/** Lets any visitor flag a portfolio that breaks the platform's publishing rules. */
export function ReportDialog({
  portfolioId,
  portfolioName,
  rules,
  copy,
  locale,
}: {
  portfolioId: string;
  portfolioName: string;
  rules: string;
  /**
   * The visitor's language, not the portfolio's. The page around this belongs to
   * its designer; this dialog belongs to whoever is filing the report.
   */
  copy: Dictionary["report"];
  locale: Locale;
}) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(submitReportAction, null);

  // The action answers with keys so it does not have to know the language.
  const say = (key?: string) => {
    if (!key) return undefined;
    const [name, argument] = key.split(":");
    const template = (copy.errors as Record<string, string>)[name];
    if (!template) return name === "sent" ? copy.sent : key;
    return argument ? fill(template, { minutes: argument }) : template;
  };
  const translated = state
    ? { ok: state.ok ? copy.sent : undefined, error: say(state.error) }
    : null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-[11.5px] text-mist-600 transition hover:text-mist-300"
      >
        <Flag className="h-3.5 w-3.5" />
        {copy.trigger}
      </button>

      {open && (
        <Modal onClose={() => setOpen(false)}>
          <div className="card my-auto w-full max-w-md p-6 text-start">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-[17px] font-bold">{fill(copy.title, { name: portfolioName })}</h2>
                <p className="mt-1 text-[12.5px] leading-relaxed text-mist-400">
                  {copy.intro}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={copy.close}
                className="icon-btn !h-9 !w-9"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {rules && (
              <p className="panel mb-4 px-3.5 py-3 text-[11.5px] leading-relaxed text-mist-500">
                {rules}{" "}
                <a
                  href="/legal/rules"
                  target="_blank"
                  rel="noreferrer"
                  className="underline decoration-white/25 underline-offset-4 hover:text-mist-300"
                >
                  {copy.fullRules}
                </a>
              </p>
            )}

            {state?.ok ? (
              <div className="space-y-4">
                <Status state={translated} />
                <button type="button" onClick={() => setOpen(false)} className="btn btn-ghost w-full">
                  {copy.close}
                </button>
              </div>
            ) : (
              <form action={action} className="space-y-4">
                <input type="hidden" name="portfolioId" value={portfolioId} />

                <Field label={copy.reason}>
                  <select name="reason" className="field" required defaultValue="">
                    <option value="" disabled>
                      {copy.reasonPlaceholder}
                    </option>
                    {REPORT_REASONS.map((reason) => (
                      <option key={reason.value} value={reason.value}>
                        {locale === "en" ? reason.labelEn : reason.label}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label={copy.details} hint={copy.detailsHint}>
                  <textarea name="description" rows={4} className="field" required minLength={10} />
                </Field>

                <Field label={copy.evidence} hint={copy.evidenceHint}>
                  <input name="evidenceUrl" className="field" dir="ltr" placeholder="https://" />
                </Field>

                <Field label={copy.email} hint={copy.emailHint}>
                  <input name="email" type="email" className="field" dir="ltr" required />
                </Field>

                <Status state={translated} />
                <Submit className="btn btn-primary w-full" pendingLabel={copy.sending}>
                  <Flag className="h-4 w-4" />
                  {copy.submit}
                </Submit>
              </form>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}
