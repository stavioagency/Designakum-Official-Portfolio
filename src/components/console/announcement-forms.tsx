"use client";

import { useActionState } from "react";
import {
  createAnnouncementAction,
  deleteAnnouncementAction,
  toggleAnnouncementAction,
} from "@/app/actions/announcements";
import { Field, Status, Submit } from "@/components/editor/ui";
import { ConfirmSubmit } from "./forms";
import { Megaphone } from "@/components/icons";

export function CreateAnnouncementForm() {
  const [state, action] = useActionState(createAnnouncementAction, null);

  return (
    <form action={action} className="space-y-4 p-5">
      <div className="grid gap-4 sm:grid-cols-[1fr_180px]">
        <Field label="العنوان">
          <input name="title" className="field" required minLength={3} placeholder="تحديث جديد على المنصة" />
        </Field>
        <Field label="النوع">
          <select name="severity" defaultValue="info" className="field">
            <option value="info">معلومة</option>
            <option value="success">خبر جيد</option>
            <option value="warning">تنبيه</option>
            <option value="critical">حرج</option>
          </select>
        </Field>
      </div>

      <Field label="النص">
        <textarea name="body" rows={3} className="field" placeholder="اشرح التحديث بإيجاز…" />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="يبدأ في" hint="اتركه فارغًا ليظهر فورًا.">
          <input name="startsAt" type="date" className="field" />
        </Field>
        <Field label="ينتهي في" hint="اتركه فارغًا ليستمر حتى توقفه.">
          <input name="endsAt" type="date" className="field" />
        </Field>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Submit className="btn btn-primary">
          <Megaphone className="h-4 w-4" />
          نشر الإعلان
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
}: {
  id: string;
  title: string;
  active: boolean;
}) {
  const [toggleState, toggle] = useActionState(toggleAnnouncementAction, null);
  const [deleteState, remove] = useActionState(deleteAnnouncementAction, null);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <form action={toggle}>
        <input type="hidden" name="announcementId" value={id} />
        <Submit className="btn btn-ghost !px-3 !py-1.5 !text-[12px]" pendingLabel="…">
          {active ? "إيقاف" : "تفعيل"}
        </Submit>
      </form>

      <form action={remove}>
        <input type="hidden" name="announcementId" value={id} />
        <ConfirmSubmit
          label="حذف"
          className="btn btn-danger !px-3 !py-1.5 !text-[12px]"
          title="حذف هذا الإعلان؟"
          body={`سيختفي «${title}» من لوحات العملاء نهائيًا.`}
          confirmLabel="حذف الإعلان"
        />
      </form>

      <Status state={toggleState} />
      <Status state={deleteState} />
    </div>
  );
}
