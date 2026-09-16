"use client";

import { useActionState, useState } from "react";
import {
  createInvitationAction,
  revokeInvitationAction,
} from "@/app/actions/invitations";
import { Field, Status, Submit } from "@/components/editor/ui";
import { ConfirmSubmit } from "./forms";
import { Check, Gift, Link as LinkIcon } from "@/components/icons";
import { fill, type Dictionary } from "@/lib/i18n";

export interface DialogChrome {
  cancel: string;
  pending: string;
  confirmParts: [string, string];
}

type Copy = Dictionary["console"]["invitations"];

export function CreateInvitationForm({
  copy,
  plans,
}: {
  copy: Copy;
  plans: { monthly: string; yearly: string };
}) {
  const [state, action] = useActionState(createInvitationAction, null);

  return (
    <form action={action} className="space-y-4 p-5">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label={copy.plan}>
          <select name="plan" defaultValue="monthly" className="field">
            <option value="monthly">{plans.monthly}</option>
            <option value="yearly">{plans.yearly}</option>
          </select>
        </Field>
        <Field label={copy.duration} hint={copy.durationHint}>
          <input name="months" type="number" min={1} max={60} defaultValue={3} className="field" />
        </Field>
        <Field label={copy.maxUses}>
          <input name="maxUses" type="number" min={1} max={1000} defaultValue={1} className="field" />
        </Field>
        <Field label={copy.expiresAt} hint={copy.expiresHint}>
          <input name="expiresAt" type="date" className="field" />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={copy.inviteeEmail} hint={copy.inviteeHint}>
          <input name="email" type="email" dir="ltr" className="field" placeholder="name@example.com" />
        </Field>
        <Field label={copy.note}>
          <input name="note" className="field" placeholder={copy.notePlaceholder} />
        </Field>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Submit className="btn btn-primary">
          <Gift className="h-4 w-4" />
          {copy.submit}
        </Submit>
        <Status state={state} />
      </div>
    </form>
  );
}

export function CopyInvitationLink({
  code,
  origin,
  copy,
}: {
  code: string;
  origin: string;
  copy: Copy;
}) {
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
      {copied ? copy.copied : copy.copyLink}
    </button>
  );
}

export function RevokeInvitation({
  id,
  code,
  copy,
  dialog,
}: {
  id: string;
  code: string;
  copy: Copy;
  dialog: DialogChrome;
}) {
  const [state, action] = useActionState(revokeInvitationAction, null);

  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="invitationId" value={id} />
      <input type="hidden" name="code" value={code} />
      <ConfirmSubmit
            cancelLabel={dialog.cancel}
            pendingLabel={dialog.pending}
            confirmParts={dialog.confirmParts}
        label={copy.revoke}
        className="btn btn-danger !px-3 !py-1.5 !text-[12px]"
        title={copy.revokeTitle}
        body={fill(copy.revokeBody, { code })}
        confirmLabel={copy.revokeConfirm}
      />
      <Status state={state} />
    </form>
  );
}
