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
import type { Dictionary } from "@/lib/i18n";
import { fill } from "@/lib/i18n";

type Copy = Dictionary["console"]["report"];

export function AssignReport({
  reportId,
  assigneeId,
  staff,
  copy,
}: {
  reportId: string;
  assigneeId: string | null;
  staff: { id: string; label: string }[];
  copy: Copy;
}) {
  const [state, action] = useActionState(assignReportAction, null);

  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="reportId" value={reportId} />
      <AutoSubmitSelect
        name="assigneeId"
        ariaLabel={copy.assignReport}
        defaultValue={assigneeId ?? ""}
        options={[
          { value: "", label: copy.unassigned },
          ...staff.map((member) => ({ value: member.id, label: member.label })),
        ]}
      />
      <Status state={state} />
    </form>
  );
}

export function ReportNoteForm({ reportId, copy }: { reportId: string; copy: Copy }) {
  const [state, action] = useActionState(addReportNoteAction, null);

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="reportId" value={reportId} />
      <textarea
        name="body"
        rows={3}
        className="field"
        placeholder={copy.notePlaceholder}
        required
        minLength={2}
      />
      <div className="flex flex-wrap items-center gap-3">
        <Submit className="btn btn-ghost">{copy.addNote}</Submit>
        <Status state={state} />
      </div>
    </form>
  );
}

export function ReportDecision({
  reportId,
  status,
  copy,
}: {
  reportId: string;
  status: ReportStatus;
  copy: Copy;
}) {
  const [state, action] = useActionState(setReportStatusAction, null);

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="reportId" value={reportId} />
      <Field label={copy.summary} hint={copy.summaryHint}>
        <input name="resolution" className="field" placeholder={copy.summaryPlaceholder} />
      </Field>
      <div className="flex flex-wrap items-center gap-2">
        {status !== "reviewing" && (
          <button type="submit" name="status" value="reviewing" className="btn btn-ghost !px-3.5 !py-2 !text-[13px]">
            <Flag className="h-4 w-4" />
            {copy.markReviewing}
          </button>
        )}
        <button type="submit" name="status" value="resolved" className="btn btn-primary !px-3.5 !py-2 !text-[13px]">
          <Check className="h-4 w-4" />
          {copy.markResolved}
        </button>
        <button type="submit" name="status" value="dismissed" className="btn btn-ghost !px-3.5 !py-2 !text-[13px]">
          <X className="h-4 w-4" />
          {copy.dismiss}
        </button>
        <Status state={state} />
      </div>
    </form>
  );
}

export function WarnOwnerForm({ reportId, copy }: { reportId: string; copy: Copy }) {
  const [state, action] = useActionState(warnOwnerAction, null);

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="reportId" value={reportId} />
      <Field label={copy.warningBody} hint={copy.warningHint}>
        <textarea
          name="message"
          rows={4}
          className="field"
          required
          minLength={10}
          defaultValue={copy.warningDefault}
        />
      </Field>
      <div className="flex flex-wrap items-center gap-2">
        <Submit className="btn btn-ghost !px-3.5 !py-2 !text-[13px]">{copy.sendWarning}</Submit>
        <button
          type="submit"
          name="removal"
          value="1"
          className="btn btn-ghost !px-3.5 !py-2 !text-[13px]"
        >
          {copy.requestRemoval}
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
  copy,
}: {
  userId: string;
  email: string;
  reportId?: string;
  copy: Copy;
}) {
  const [state, action] = useActionState(banAccountAction, null);

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="userId" value={userId} />
      {reportId && <input type="hidden" name="reportId" value={reportId} />}
      <Field label={copy.suspendReason}>
        <input
          name="reason"
          className="field"
          required
          minLength={5}
          placeholder={copy.suspendReasonPlaceholder}
        />
      </Field>
      <div className="flex flex-wrap items-center gap-3">
        <ConfirmSubmit
          label={copy.suspendLabel}
          icon={<Ban className="h-4 w-4" />}
          title={copy.suspendTitle}
          body={fill(copy.suspendBody, { email })}
          confirmLabel={copy.suspendConfirm}
        />
        <Status state={state} />
      </div>
    </form>
  );
}
