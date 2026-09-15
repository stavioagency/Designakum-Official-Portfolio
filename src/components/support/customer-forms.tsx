"use client";

import { useActionState } from "react";
import {
  closeOwnTicketAction,
  createTicketAction,
  replyAsCustomerAction,
} from "@/app/actions/support";
import { Field, Status, Submit } from "@/components/editor/ui";
import { TICKET_CATEGORIES } from "@/lib/support-labels";
import { LifeBuoy } from "@/components/icons";

export function NewTicketForm({ intro }: { intro: string }) {
  const [state, action] = useActionState(createTicketAction, null);

  return (
    <form action={action} className="space-y-4">
      {intro && <p className="text-[13px] leading-relaxed text-mist-400">{intro}</p>}

      <div className="grid gap-4 sm:grid-cols-[1fr_200px]">
        <Field label="عنوان المشكلة">
          <input name="subject" className="field" required minLength={4} placeholder="مثال: لا أستطيع رفع صورة" />
        </Field>
        <Field label="التصنيف">
          <select name="category" defaultValue="general" className="field">
            {TICKET_CATEGORIES.map((category) => (
              <option key={category.value} value={category.value}>
                {category.label}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="التفاصيل" hint="كلما كان الشرح أدق، كان الرد أسرع.">
        <textarea name="body" rows={5} className="field" required minLength={10} />
      </Field>

      <div className="flex flex-wrap items-center gap-3">
        <Submit>
          <LifeBuoy className="h-4 w-4" />
          إرسال التذكرة
        </Submit>
        <Status state={state} />
      </div>
    </form>
  );
}

export function CustomerReplyForm({ ticketId, resolved }: { ticketId: string; resolved: boolean }) {
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
          placeholder={resolved ? "الرد على تذكرة مغلقة سيعيد فتحها…" : "اكتب ردك…"}
          required
          minLength={2}
        />
        <div className="flex flex-wrap items-center gap-3">
          <Submit>إرسال</Submit>
          <Status state={replyState} />
        </div>
      </form>

      {!resolved && (
        <form action={close} className="flex flex-wrap items-center gap-3 border-t border-white/8 pt-4">
          <input type="hidden" name="ticketId" value={ticketId} />
          <Submit className="btn btn-ghost !px-3.5 !py-2 !text-[13px]" pendingLabel="…">
            تم حل المشكلة، أغلق التذكرة
          </Submit>
          <Status state={closeState} />
        </form>
      )}
    </div>
  );
}
