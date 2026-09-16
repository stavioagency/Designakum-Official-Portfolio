"use server";

import { revalidatePath } from "next/cache";
import { messages } from "@/lib/locale";
import { fill } from "@/lib/i18n";
import { audit } from "@/lib/audit";
import { requireUser } from "@/lib/auth";
import { getCustomer } from "@/lib/customers";
import { PermissionError, requirePermission } from "@/lib/permissions";
import { callerFingerprint, rateLimit } from "@/lib/rate-limit";
import { readSettings } from "@/lib/settings";
import {
  addTicketMessage,
  createTicket,
  getTicket,
  setTicketField,
  TICKET_PRIORITIES,
  TICKET_STATUSES,
} from "@/lib/support";
import type { TicketPriority, TicketStatus } from "@/lib/types";
import type { ActionState } from "./console";
import { reportError } from "@/lib/observability";

const str = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();

async function fail(error: unknown): Promise<ActionState> {
  // A refused permission is an expected outcome, not an incident.
  if (error instanceof PermissionError) return { error: error.message };
  reportError(error, { area: "action" });
  return { error: error instanceof Error ? error.message : (await messages()).failed };
}

function refresh(ticketId?: string) {
  revalidatePath("/console");
  revalidatePath("/console/support");
  revalidatePath("/dashboard/support");
  if (ticketId) {
    revalidatePath(`/console/support/${ticketId}`);
    revalidatePath(`/dashboard/support/${ticketId}`);
  }
}

/* ---------------------------------------------------------------- customer */

export async function createTicketAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    if (!(await readSettings())["features.support"]) return { error: (await messages()).supportClosed };

    const user = await requireUser();
    const fingerprint = await callerFingerprint();
    const limit = await rateLimit(`ticket:${user.id}:${fingerprint}`, 5, 60 * 60 * 1000);
    if (!limit.ok) {
      return { error: (await messages()).tooManyTickets };
    }

    const subject = str(fd, "subject");
    const body = str(fd, "body");
    if (subject.length < 4) return { error: (await messages()).ticketSubjectShort };
    if (body.length < 10) return { error: (await messages()).ticketBodyShort };

    const ticket = await createTicket({
      user,
      subject: subject.slice(0, 160),
      category: str(fd, "category") || "general",
      priority: "normal",
      body: body.slice(0, 5000),
    });

    refresh(ticket.id);
    return { ok: (await messages()).ticketSent };
  } catch (error) {
    return await fail(error);
  }
}

export async function replyAsCustomerAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const user = await requireUser();
    const ticketId = str(fd, "ticketId");
    const body = str(fd, "body");
    if (body.length < 2) return { error: (await messages()).emptyMessage };

    const ticket = await getTicket(ticketId);
    // Tenant isolation: a customer may only ever write to their own ticket.
    if (!ticket || ticket.user_id !== user.id) return { error: (await messages()).ticketMissing };

    await addTicketMessage(ticketId, user, body.slice(0, 5000), false, "customer");
    if (ticket.status === "waiting_customer" || ticket.status === "resolved") {
      await setTicketField(ticketId, "status", "open");
    }

    refresh(ticketId);
    return { ok: (await messages()).replySent };
  } catch (error) {
    return await fail(error);
  }
}

export async function closeOwnTicketAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const user = await requireUser();
    const ticketId = str(fd, "ticketId");
    const ticket = await getTicket(ticketId);
    if (!ticket || ticket.user_id !== user.id) return { error: (await messages()).ticketMissing };

    await setTicketField(ticketId, "status", "resolved");
    refresh(ticketId);
    return { ok: (await messages()).ticketClosed };
  } catch (error) {
    return await fail(error);
  }
}

/* ------------------------------------------------------------------- staff */

export async function replyAsStaffAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const actor = await requirePermission("support.manage");
    const ticketId = str(fd, "ticketId");
    const body = str(fd, "body");
    const internal = str(fd, "internal") === "1";
    if (body.length < 2) return { error: (await messages()).emptyMessage };

    const ticket = await getTicket(ticketId);
    if (!ticket) return { error: (await messages()).ticketMissing };

    await addTicketMessage(ticketId, actor, body.slice(0, 5000), internal, "staff");
    if (!internal && ticket.status === "open") {
      await setTicketField(ticketId, "status", "waiting_customer");
    }

    await audit({
      actor,
      action: internal ? "ticket.internal_note" : "ticket.replied",
      targetType: "ticket",
      targetId: ticketId,
      targetLabel: ticket.subject,
      detail: body.slice(0, 160),
    });

    refresh(ticketId);
    const m = await messages();
    return { ok: internal ? m.internalNoteAdded : m.staffReplySent };
  } catch (error) {
    return await fail(error);
  }
}

export async function updateTicketAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const actor = await requirePermission("support.manage");
    const ticketId = str(fd, "ticketId");
    const ticket = await getTicket(ticketId);
    if (!ticket) return { error: (await messages()).ticketMissing };

    const status = str(fd, "status");
    const priority = str(fd, "priority");
    const assigneeId = fd.get("assigneeId") === null ? null : str(fd, "assigneeId");

    if (status) {
      if (!TICKET_STATUSES.includes(status as TicketStatus)) return { error: (await messages()).unknownStatus };
      await setTicketField(ticketId, "status", status);
    }
    if (priority) {
      if (!TICKET_PRIORITIES.includes(priority as TicketPriority)) return { error: (await messages()).unknownPriority };
      await setTicketField(ticketId, "priority", priority);
    }
    if (fd.get("assigneeId") !== null) {
      if (assigneeId && !await getCustomer(assigneeId)) return { error: (await messages()).staffMissing };
      await setTicketField(ticketId, "assignee_id", assigneeId || null);
    }

    await audit({
      actor,
      action: "ticket.updated",
      targetType: "ticket",
      targetId: ticketId,
      targetLabel: ticket.subject,
      before: { status: ticket.status, priority: ticket.priority, assignee_id: ticket.assignee_id },
      after: {
        status: status || ticket.status,
        priority: priority || ticket.priority,
        assignee_id: fd.get("assigneeId") !== null ? assigneeId : ticket.assignee_id,
      },
    });

    refresh(ticketId);
    return { ok: (await messages()).ticketUpdated };
  } catch (error) {
    return await fail(error);
  }
}
