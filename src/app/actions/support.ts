"use server";

import { revalidatePath } from "next/cache";
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

function fail(error: unknown): ActionState {
  // A refused permission is an expected outcome, not an incident.
  if (error instanceof PermissionError) return { error: error.message };
  reportError(error, { area: "action" });
  return { error: error instanceof Error ? error.message : "تعذّر تنفيذ العملية" };
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
    if (!readSettings()["features.support"]) return { error: "الدعم الفني متوقف حاليًا" };

    const user = await requireUser();
    const fingerprint = await callerFingerprint();
    const limit = rateLimit(`ticket:${user.id}:${fingerprint}`, 5, 60 * 60 * 1000);
    if (!limit.ok) {
      return { error: "أرسلت عدة تذاكر خلال وقت قصير. انتظر قليلاً قبل إرسال تذكرة جديدة." };
    }

    const subject = str(fd, "subject");
    const body = str(fd, "body");
    if (subject.length < 4) return { error: "اكتب عنوانًا واضحًا للمشكلة" };
    if (body.length < 10) return { error: "اشرح المشكلة بتفصيل أكبر" };

    const ticket = createTicket({
      user,
      subject: subject.slice(0, 160),
      category: str(fd, "category") || "general",
      priority: "normal",
      body: body.slice(0, 5000),
    });

    refresh(ticket.id);
    return { ok: "تم إرسال تذكرتك، وسنرد عليك قريبًا" };
  } catch (error) {
    return fail(error);
  }
}

export async function replyAsCustomerAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const user = await requireUser();
    const ticketId = str(fd, "ticketId");
    const body = str(fd, "body");
    if (body.length < 2) return { error: "الرسالة فارغة" };

    const ticket = getTicket(ticketId);
    // Tenant isolation: a customer may only ever write to their own ticket.
    if (!ticket || ticket.user_id !== user.id) return { error: "التذكرة غير موجودة" };

    addTicketMessage(ticketId, user, body.slice(0, 5000), false, "customer");
    if (ticket.status === "waiting_customer" || ticket.status === "resolved") {
      setTicketField(ticketId, "status", "open");
    }

    refresh(ticketId);
    return { ok: "تم إرسال ردك" };
  } catch (error) {
    return fail(error);
  }
}

export async function closeOwnTicketAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const user = await requireUser();
    const ticketId = str(fd, "ticketId");
    const ticket = getTicket(ticketId);
    if (!ticket || ticket.user_id !== user.id) return { error: "التذكرة غير موجودة" };

    setTicketField(ticketId, "status", "resolved");
    refresh(ticketId);
    return { ok: "تم إغلاق التذكرة" };
  } catch (error) {
    return fail(error);
  }
}

/* ------------------------------------------------------------------- staff */

export async function replyAsStaffAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const actor = await requirePermission("support.manage");
    const ticketId = str(fd, "ticketId");
    const body = str(fd, "body");
    const internal = str(fd, "internal") === "1";
    if (body.length < 2) return { error: "الرسالة فارغة" };

    const ticket = getTicket(ticketId);
    if (!ticket) return { error: "التذكرة غير موجودة" };

    addTicketMessage(ticketId, actor, body.slice(0, 5000), internal, "staff");
    if (!internal && ticket.status === "open") {
      setTicketField(ticketId, "status", "waiting_customer");
    }

    audit({
      actor,
      action: internal ? "ticket.internal_note" : "ticket.replied",
      targetType: "ticket",
      targetId: ticketId,
      targetLabel: ticket.subject,
      detail: body.slice(0, 160),
    });

    refresh(ticketId);
    return { ok: internal ? "تمت إضافة الملاحظة الداخلية" : "تم إرسال الرد" };
  } catch (error) {
    return fail(error);
  }
}

export async function updateTicketAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const actor = await requirePermission("support.manage");
    const ticketId = str(fd, "ticketId");
    const ticket = getTicket(ticketId);
    if (!ticket) return { error: "التذكرة غير موجودة" };

    const status = str(fd, "status");
    const priority = str(fd, "priority");
    const assigneeId = fd.get("assigneeId") === null ? null : str(fd, "assigneeId");

    if (status) {
      if (!TICKET_STATUSES.includes(status as TicketStatus)) return { error: "حالة غير معروفة" };
      setTicketField(ticketId, "status", status);
    }
    if (priority) {
      if (!TICKET_PRIORITIES.includes(priority as TicketPriority)) return { error: "أولوية غير معروفة" };
      setTicketField(ticketId, "priority", priority);
    }
    if (fd.get("assigneeId") !== null) {
      if (assigneeId && !getCustomer(assigneeId)) return { error: "الموظف غير موجود" };
      setTicketField(ticketId, "assignee_id", assigneeId || null);
    }

    audit({
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
    return { ok: "تم تحديث التذكرة" };
  } catch (error) {
    return fail(error);
  }
}
