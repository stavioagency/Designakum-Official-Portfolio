"use client";

import { useActionState } from "react";
import {
  addReportNoteAction,
  assignReportAction,
  banAccountAction,
  setReportStatusAction,
  warnOwnerAction,
} from "@/app/actions/moderation";
import { Field, Status, Submit } from "@/components/editor/ui";
import { AutoSubmitSelect, ConfirmSubmit } from "./forms";
import { Ban, Check, Flag, X } from "@/components/icons";
import type { ReportStatus } from "@/lib/types";

export function AssignReport({
  reportId,
  assigneeId,
  staff,
}: {
  reportId: string;
  assigneeId: string | null;
  staff: { id: string; label: string }[];
}) {
  const [state, action] = useActionState(assignReportAction, null);

  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="reportId" value={reportId} />
      <AutoSubmitSelect
        name="assigneeId"
        ariaLabel="إسناد البلاغ"
        defaultValue={assigneeId ?? ""}
        options={[
          { value: "", label: "بدون إسناد" },
          ...staff.map((member) => ({ value: member.id, label: member.label })),
        ]}
      />
      <Status state={state} />
    </form>
  );
}

export function ReportNoteForm({ reportId }: { reportId: string }) {
  const [state, action] = useActionState(addReportNoteAction, null);

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="reportId" value={reportId} />
      <textarea
        name="body"
        rows={3}
        className="field"
        placeholder="ملاحظة داخلية لفريق ديزاينكم — لا يراها العميل."
        required
        minLength={2}
      />
      <div className="flex flex-wrap items-center gap-3">
        <Submit className="btn btn-ghost">إضافة ملاحظة</Submit>
        <Status state={state} />
      </div>
    </form>
  );
}

export function ReportDecision({
  reportId,
  status,
}: {
  reportId: string;
  status: ReportStatus;
}) {
  const [state, action] = useActionState(setReportStatusAction, null);

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="reportId" value={reportId} />
      <Field label="الخلاصة" hint="تُحفظ مع البلاغ وفي سجل التدقيق.">
        <input name="resolution" className="field" placeholder="ما الذي تقرّر ولماذا…" />
      </Field>
      <div className="flex flex-wrap items-center gap-2">
        {status !== "reviewing" && (
          <button type="submit" name="status" value="reviewing" className="btn btn-ghost !px-3.5 !py-2 !text-[13px]">
            <Flag className="h-4 w-4" />
            تحت المراجعة
          </button>
        )}
        <button type="submit" name="status" value="resolved" className="btn btn-primary !px-3.5 !py-2 !text-[13px]">
          <Check className="h-4 w-4" />
          إغلاق كمعالج
        </button>
        <button type="submit" name="status" value="dismissed" className="btn btn-ghost !px-3.5 !py-2 !text-[13px]">
          <X className="h-4 w-4" />
          رفض البلاغ
        </button>
        <Status state={state} />
      </div>
    </form>
  );
}

export function WarnOwnerForm({ reportId }: { reportId: string }) {
  const [state, action] = useActionState(warnOwnerAction, null);

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="reportId" value={reportId} />
      <Field label="نص الرسالة" hint="تصل للعميل كتذكرة دعم عالية الأولوية يمكنه الرد عليها.">
        <textarea
          name="message"
          rows={4}
          className="field"
          required
          minLength={10}
          defaultValue="وصلنا بلاغ بخصوص محتوى في معرضك. نرجو مراجعته وتعديل ما يخالف قواعد النشر خلال 7 أيام."
        />
      </Field>
      <div className="flex flex-wrap items-center gap-2">
        <Submit className="btn btn-ghost !px-3.5 !py-2 !text-[13px]">إرسال تحذير</Submit>
        <button
          type="submit"
          name="removal"
          value="1"
          className="btn btn-ghost !px-3.5 !py-2 !text-[13px]"
        >
          طلب إزالة المحتوى
        </button>
        <Status state={state} />
      </div>
    </form>
  );
}

export function BanAccountForm({
  userId,
  email,
  reportId,
}: {
  userId: string;
  email: string;
  reportId?: string;
}) {
  const [state, action] = useActionState(banAccountAction, null);

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="userId" value={userId} />
      {reportId && <input type="hidden" name="reportId" value={reportId} />}
      <Field label="سبب الإيقاف الدائم">
        <input name="reason" className="field" required minLength={5} placeholder="مخالفة جسيمة ومتكررة…" />
      </Field>
      <div className="flex flex-wrap items-center gap-3">
        <ConfirmSubmit
          label="إيقاف الحساب والمعرض"
          icon={<Ban className="h-4 w-4" />}
          title="إيقاف هذا الحساب نهائيًا؟"
          body={`سيفقد ${email} الدخول ويُخفى معرضه عن العامة. تبقى كل البيانات وسجل الإشراف محفوظة، ويمكن التراجع لاحقًا من ملف العميل.`}
          confirmLabel="إيقاف نهائي"
        />
        <Status state={state} />
      </div>
    </form>
  );
}
