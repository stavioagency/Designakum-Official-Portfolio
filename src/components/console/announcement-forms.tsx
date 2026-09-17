"use client";

import { useActionState } from "react";
import { ANNOUNCEMENT_HOURS } from "@/lib/announcement-durations";
import {
  createAnnouncementAction,
  deleteAnnouncementAction,
  toggleAnnouncementAction,
} from "@/app/actions/announcements";
import { Field, Status, Submit } from "@/components/editor/ui";
import { ConfirmSubmit } from "./forms";
import { Megaphone } from "@/components/icons";
import { fill, type Dictionary } from "@/lib/i18n";

export interface DialogChrome {
  cancel: string;
  pending: string;
  confirmParts: [string, string];
}

type Copy = Dictionary["console"]["announcements"];

export function CreateAnnouncementForm({ copy }: { copy: Copy }) {
  const [state, action] = useActionState(createAnnouncementAction, null);

  return (
    <form action={action} className="space-y-4 p-5">
      <div className="grid gap-4 sm:grid-cols-[1fr_180px]">
        <Field label={copy.formTitle}>
          <input
            name="title"
            className="field"
            required
            minLength={3}
            placeholder={copy.formTitlePlaceholder}
          />
        </Field>
        <Field label={copy.formKind}>
          <select name="severity" defaultValue="info" className="field">
            <option value="info">{copy.kindInfo}</option>
            <option value="success">{copy.kindSuccess}</option>
            <option value="warning">{copy.kindWarning}</option>
            <option value="critical">{copy.kindCritical}</option>
          </select>
        </Field>
      </div>

      <Field label={copy.formBody}>
        <textarea name="body" rows={3} className="field" placeholder={copy.formBodyPlaceholder} />
      </Field>

      {/* Optional. Customers on the English interface see these instead; leaving
          them blank shows them the Arabic rather than nothing. */}
      <div className="grid gap-4 sm:grid-cols-2" dir="ltr">
        <Field label={copy.englishTitle} hint={copy.englishHint}>
          <input name="titleEn" className="field" placeholder="A new platform update" />
        </Field>
        <Field label={copy.englishBody}>
          <textarea name="bodyEn" rows={3} className="field" placeholder="Explain the update briefly…" />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={copy.startsAt} hint={copy.startsHint}>
          <input name="startsAt" type="date" className="field" />
        </Field>
        <Field label={copy.runFor} hint={copy.runForHint}>
          <select name="runHours" defaultValue="168" className="field">
            {ANNOUNCEMENT_HOURS.map((hours) => (
              <option key={hours} value={hours}>
                {copy.durations[String(hours) as keyof typeof copy.durations]}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Submit className="btn btn-primary">
          <Megaphone className="h-4 w-4" />
          {copy.publish}
        </Submit>
        <Status state={state} />
      </div>
    </form>
  );
}

export function AnnouncementControls({
  id,
  title,
  active,
  copy,
  dialog,
}: {
  id: string;
  title: string;
  active: boolean;
  copy: Copy;
  dialog: DialogChrome;
}) {
  const [toggleState, toggle] = useActionState(toggleAnnouncementAction, null);
  const [deleteState, remove] = useActionState(deleteAnnouncementAction, null);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <form action={toggle}>
        <input type="hidden" name="announcementId" value={id} />
        <Submit className="btn btn-ghost !px-3 !py-1.5 !text-[12px]" pendingLabel="…">
          {active ? copy.pause : copy.resume}
        </Submit>
      </form>

      <form action={remove}>
        <input type="hidden" name="announcementId" value={id} />
        <ConfirmSubmit
            cancelLabel={dialog.cancel}
            pendingLabel={dialog.pending}
            confirmParts={dialog.confirmParts}
          label={copy.remove}
          className="btn btn-danger !px-3 !py-1.5 !text-[12px]"
          title={copy.removeTitle}
          body={fill(copy.removeBody, { title })}
          confirmLabel={copy.removeConfirm}
        />
      </form>

      <Status state={toggleState} />
      <Status state={deleteState} />
    </div>
  );
}
