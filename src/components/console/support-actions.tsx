"use client";

import { useActionState } from "react";
import { replyAsStaffAction, updateTicketAction } from "@/app/actions/support";
import { Status, Submit } from "@/components/editor/ui";
import { AutoSubmitSelect } from "./forms";
import {
  TICKET_PRIORITY_LABEL,
  TICKET_STATUS_LABEL,
} from "@/lib/support-labels";
import type { TicketPriority, TicketStatus } from "@/lib/types";

export function TicketControls({
  ticketId,
  status,
  priority,
  assigneeId,
  staff,
}: {
  ticketId: string;
  status: TicketStatus;
  priority: TicketPriority;
  assigneeId: string | null;
  staff: { id: string; label: string }[];
}) {
  const [state, action] = useActionState(updateTicketAction, null);

  return (
    <div className="space-y-3">
      <form action={action} className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="ticketId" value={ticketId} />
        <AutoSubmitSelect
          name="status"
          ariaLabel="حالة التذكرة"
          defaultValue={status}
          options={Object.entries(TICKET_STATUS_LABEL).map(([value, label]) => ({ value, label }))}
        />
      </form>

      <form action={action} className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="ticketId" value={ticketId} />
        <AutoSubmitSelect
          name="priority"
          ariaLabel="أولوية التذكرة"
          defaultValue={priority}
          options={Object.entries(TICKET_PRIORITY_LABEL).map(([value, label]) => ({ value, label }))}
        />
      </form>

      <form action={action} className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="ticketId" value={ticketId} />
        <AutoSubmitSelect
          name="assigneeId"
          ariaLabel="إسناد التذكرة"
          defaultValue={assigneeId ?? ""}
          options={[
            { value: "", label: "بدون إسناد" },
            ...staff.map((member) => ({ value: member.id, label: member.label })),
          ]}
        />
      </form>

      <Status state={state} />
    </div>
  );
}

export function StaffReplyForm({ ticketId }: { ticketId: string }) {
  const [state, action] = useActionState(replyAsStaffAction, null);

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="ticketId" value={ticketId} />
      <textarea
        name="body"
        rows={4}
        className="field"
        placeholder="اكتب ردك للعميل…"
        required
        minLength={2}
      />
      <div className="flex flex-wrap items-center gap-2">
        <Submit className="btn btn-primary">إرسال للعميل</Submit>
        <button
          type="submit"
          name="internal"
          value="1"
          className="btn btn-ghost !px-3.5 !py-2 !text-[13px]"
          title="ملاحظة داخلية لا يراها العميل"
        >
          حفظ كملاحظة داخلية
        </button>
        <Status state={state} />
      </div>
    </form>
  );
}
