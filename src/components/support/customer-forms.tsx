"use client";

import { useActionState } from "react";
import {
  closeOwnTicketAction,
  createTicketAction,
  replyAsCustomerAction,
} from "@/app/actions/support";
import { Field, Status, Submit } from "@/components/editor/ui";
import type { Dictionary } from "@/lib/i18n";
import { LifeBuoy } from "@/components/icons";

type Copy = Dictionary["dashboard"]["support"];

export function NewTicketForm({
  intro,
  copy,
  categories,
}: {
  intro: string;
  copy: Copy;
  categories: { value: string; label: string }[];
}) {
  const [state, action] = useActionState(createTicketAction, null);

  return (
    <form action={action} className="space-y-4">
      {intro && <p className="text-[13px] leading-relaxed text-mist-400">{intro}</p>}

      <div className="grid gap-4 sm:grid-cols-[1fr_200px]">
        <Field label={copy.subject}>
          <input
            name="subject"
            className="field"
            required
            minLength={4}
            placeholder={copy.subjectPlaceholder}
          />
        </Field>
        <Field label={copy.category}>
          <select name="category" defaultValue="general" className="field">
            {categories.map((category) => (
              <option key={category.value} value={category.value}>
                {category.label}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label={copy.details} hint={copy.detailsHint}>
        <textarea name="body" rows={5} className="field" required minLength={10} />
      </Field>

      <div className="flex flex-wrap items-center gap-3">
        <Submit>
          <LifeBuoy className="h-4 w-4" />
          {copy.submit}
        </Submit>
        <Status state={state} />
      </div>
    </form>
  );
}

export function CustomerReplyForm({
  ticketId,
  resolved,
  copy,
}: {
  ticketId: string;
  resolved: boolean;
  copy: Copy;
}) {
  const [replyState, reply] = useActionState(replyAsCustomerAction, null);
  const [closeState, close] = useActionState(closeOwnTicketAction, null);

  return (
    <div className="space-y-4">
      <form action={reply} className="space-y-3">
        <input type="hidden" name="ticketId" value={ticketId} />
        <textarea
          name="body"
          rows={4}
          className="field"
          placeholder={resolved ? copy.reopenPlaceholder : copy.replyPlaceholder}
          required
          minLength={2}
        />
        <div className="flex flex-wrap items-center gap-3">
          <Submit>{copy.send}</Submit>
          <Status state={replyState} />
        </div>
      </form>

      {!resolved && (
        <form action={close} className="flex flex-wrap items-center gap-3 border-t border-white/8 pt-4">
          <input type="hidden" name="ticketId" value={ticketId} />
          <Submit className="btn btn-ghost !px-3.5 !py-2 !text-[13px]" pendingLabel="…">
            {copy.resolve}
          </Submit>
          <Status state={closeState} />
        </form>
      )}
    </div>
  );
}
