"use client";

import { useActionState } from "react";
import { replyAsStaffAction, updateTicketAction } from "@/app/actions/support";
import { Status, Submit } from "@/components/editor/ui";
import { AutoSubmitSelect } from "./forms";
import { TICKET_PRIORITY, TICKET_STATUS } from "@/lib/support-labels";
import type { Dictionary } from "@/lib/i18n";
import type { Locale, TicketPriority, TicketStatus } from "@/lib/types";

type Copy = Dictionary["console"]["tickets"];

export function TicketControls({
  ticketId,
  status,
  priority,
  assigneeId,
  staff,
  copy,
  locale,
}: {
  ticketId: string;
  status: TicketStatus;
  priority: TicketPriority;
  assigneeId: string | null;
  staff: { id: string; label: string }[];
  copy: Copy;
  locale: Locale;
}) {
  const [state, action] = useActionState(updateTicketAction, null);

  return (
    <div className="space-y-3">
      <form action={action} className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="ticketId" value={ticketId} />
        <AutoSubmitSelect
          name="status"
          ariaLabel={copy.ticketStatus}
          defaultValue={status}
          options={Object.entries(TICKET_STATUS).map(([value, label]) => ({
            value,
            label: label[locale] ?? label.ar,
          }))}
        />
      </form>

      <form action={action} className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="ticketId" value={ticketId} />
        <AutoSubmitSelect
          name="priority"
          ariaLabel={copy.ticketPriority}
          defaultValue={priority}
          options={Object.entries(TICKET_PRIORITY).map(([value, label]) => ({
            value,
            label: label[locale] ?? label.ar,
          }))}
        />
      </form>

      <form action={action} className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="ticketId" value={ticketId} />
        <AutoSubmitSelect
          name="assigneeId"
          ariaLabel={copy.ticketAssignee}
          defaultValue={assigneeId ?? ""}
          options={[
            { value: "", label: copy.unassigned },
            ...staff.map((member) => ({ value: member.id, label: member.label })),
          ]}
        />
      </form>

      <Status state={state} />
    </div>
  );
}

export function StaffReplyForm({ ticketId, copy }: { ticketId: string; copy: Copy }) {
  const [state, action] = useActionState(replyAsStaffAction, null);

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="ticketId" value={ticketId} />
      <textarea
        name="body"
        rows={4}
        className="field"
        placeholder={copy.replyPlaceholder}
        required
        minLength={2}
      />
      <div className="flex flex-wrap items-center gap-2">
        <Submit className="btn btn-primary">{copy.replyToCustomer}</Submit>
        <button
          type="submit"
          name="internal"
          value="1"
          className="btn btn-ghost !px-3.5 !py-2 !text-[13px]"
          title={copy.internalNoteTitle}
        >
          {copy.internalNote}
        </button>
        <Status state={state} />
      </div>
    </form>
  );
}
