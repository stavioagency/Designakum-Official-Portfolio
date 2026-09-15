"use client";

import { useActionState, useState } from "react";
import {
  createInvitationAction,
  revokeInvitationAction,
} from "@/app/actions/invitations";
import { Field, Status, Submit } from "@/components/editor/ui";
import { ConfirmSubmit } from "./forms";
import { Check, Gift, Link as LinkIcon } from "@/components/icons";

export function CreateInvitationForm() {
  const [state, action] = useActionState(createInvitationAction, null);

  return (
    <form action={action} className="space-y-4 p-5">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="الباقة">
          <select name="plan" defaultValue="monthly" className="field">
            <option value="monthly">شهرية</option>
            <option value="yearly">سنوية</option>
          </select>
        </Field>
        <Field label="المدة" hint="أشهر للشهرية، سنوات للسنوية.">
          <input name="months" type="number" min={1} max={60} defaultValue={3} className="field" />
        </Field>
        <Field label="عدد الاستخدامات">
          <input name="maxUses" type="number" min={1} max={1000} defaultValue={1} className="field" />
        </Field>
        <Field label="تاريخ الانتهاء" hint="اتركه فارغًا لدعوة بلا تاريخ انتهاء.">
          <input name="expiresAt" type="date" className="field" />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="بريد المدعو" hint="اتركه فارغًا لدعوة عامة يستخدمها أي شخص.">
          <input name="email" type="email" dir="ltr" className="field" placeholder="name@example.com" />
        </Field>
        <Field label="ملاحظة">
          <input name="note" className="field" placeholder="سبب المنح أو اسم الجهة…" />
        </Field>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Submit className="btn btn-primary">
          <Gift className="h-4 w-4" />
          إنشاء الدعوة
        </Submit>
        <Status state={state} />
      </div>
    </form>
  );
}

export function CopyInvitationLink({ code, origin }: { code: string; origin: string }) {
  const [copied, setCopied] = useState(false);
  const url = `${origin}/signup?invite=${code}`;

  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(url);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          /* clipboard blocked — the code is visible next to this button */
        }
      }}
      className="btn btn-ghost !px-3 !py-1.5 !text-[12px]"
      title={url}
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <LinkIcon className="h-3.5 w-3.5" />}
      {copied ? "تم النسخ" : "نسخ الرابط"}
    </button>
  );
}

export function RevokeInvitation({ id, code }: { id: string; code: string }) {
  const [state, action] = useActionState(revokeInvitationAction, null);

  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="invitationId" value={id} />
      <input type="hidden" name="code" value={code} />
      <ConfirmSubmit
        label="إلغاء"
        className="btn btn-danger !px-3 !py-1.5 !text-[12px]"
        title="إلغاء هذه الدعوة؟"
        body={`لن يعمل الرمز ${code} بعد الآن. الاشتراكات التي فُعّلت به سابقًا تبقى كما هي.`}
        confirmLabel="إلغاء الدعوة"
      />
      <Status state={state} />
    </form>
  );
}
