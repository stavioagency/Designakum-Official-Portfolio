"use client";

import { useActionState, useState } from "react";
import { submitReportAction } from "@/app/actions/moderation";
import { Field, Status, Submit } from "@/components/editor/ui";
import { Flag, X } from "@/components/icons";
import { REPORT_REASONS } from "@/lib/types";
import { Modal } from "@/components/ui/modal";

/** Lets any visitor flag a portfolio that breaks the platform's publishing rules. */
export function ReportDialog({
  portfolioId,
  portfolioName,
  rules,
}: {
  portfolioId: string;
  portfolioName: string;
  rules: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(submitReportAction, null);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-[11.5px] text-mist-600 transition hover:text-mist-300"
      >
        <Flag className="h-3.5 w-3.5" />
        الإبلاغ عن هذا المعرض
      </button>

      {open && (
        <Modal onClose={() => setOpen(false)}>
          <div className="card my-auto w-full max-w-md p-6 text-start">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-[17px] font-bold">الإبلاغ عن «{portfolioName}»</h2>
                <p className="mt-1 text-[12.5px] leading-relaxed text-mist-400">
                  يراجع فريق ديزاينكم كل بلاغ يدويًا. البلاغات الكيدية قد تؤدي إلى تقييد حسابك.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="إغلاق"
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
                  القواعد كاملة
                </a>
              </p>
            )}

            {state?.ok ? (
              <div className="space-y-4">
                <Status state={state} />
                <button type="button" onClick={() => setOpen(false)} className="btn btn-ghost w-full">
                  إغلاق
                </button>
              </div>
            ) : (
              <form action={action} className="space-y-4">
                <input type="hidden" name="portfolioId" value={portfolioId} />

                <Field label="سبب البلاغ">
                  <select name="reason" className="field" required defaultValue="">
                    <option value="" disabled>
                      اختر السبب
                    </option>
                    {REPORT_REASONS.map((reason) => (
                      <option key={reason.value} value={reason.value}>
                        {reason.label}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="ما المخالفة بالضبط؟" hint="اذكر التفاصيل التي تساعدنا على التحقق.">
                  <textarea name="description" rows={4} className="field" required minLength={10} />
                </Field>

                <Field label="رابط دليل" hint="اختياري — رابط للعمل الأصلي أو لقطة شاشة.">
                  <input name="evidenceUrl" className="field" dir="ltr" placeholder="https://" />
                </Field>

                <Field label="بريدك الإلكتروني" hint="نستخدمه للرد عليك عند الحاجة فقط.">
                  <input name="email" type="email" className="field" dir="ltr" required />
                </Field>

                <Status state={state} />
                <Submit className="btn btn-primary w-full">
                  <Flag className="h-4 w-4" />
                  إرسال البلاغ
                </Submit>
              </form>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}
