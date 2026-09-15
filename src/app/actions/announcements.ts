"use server";

import { revalidatePath } from "next/cache";
import { audit } from "@/lib/audit";
import { requireUser } from "@/lib/auth";
import {
  createAnnouncement,
  deleteAnnouncement,
  getAnnouncement,
  markAnnouncementRead,
  updateAnnouncement,
} from "@/lib/announcements";
import { PermissionError, requirePermission } from "@/lib/permissions";
import type { AnnouncementSeverity } from "@/lib/types";
import type { ActionState } from "./console";
import { reportError } from "@/lib/observability";

const str = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();

function fail(error: unknown): ActionState {
  // A refused permission is an expected outcome, not an incident.
  if (error instanceof PermissionError) return { error: error.message };
  reportError(error, { area: "action" });
  return { error: error instanceof Error ? error.message : "تعذّر تنفيذ العملية" };
}

const parseDate = (value: string, endOfDay = false) =>
  value ? new Date(`${value}T${endOfDay ? "23:59:59" : "00:00:00"}`).getTime() : null;

function refresh() {
  revalidatePath("/console/announcements");
  revalidatePath("/dashboard");
}

export async function createAnnouncementAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const actor = await requirePermission("announcements.manage");
    const title = str(fd, "title");
    if (title.length < 3) return { error: "اكتب عنوان الإعلان" };

    const severity = str(fd, "severity") as AnnouncementSeverity;
    if (!["info", "success", "warning", "critical"].includes(severity)) {
      return { error: "نوع غير معروف" };
    }

    const announcement = await createAnnouncement({
      title: title.slice(0, 160),
      body: str(fd, "body").slice(0, 2000),
      severity,
      startsAt: parseDate(str(fd, "startsAt")),
      endsAt: parseDate(str(fd, "endsAt"), true),
      createdBy: actor.id,
    });

    await audit({
      actor,
      action: "announcement.created",
      targetType: "announcement",
      targetId: announcement.id,
      targetLabel: announcement.title,
      after: { severity },
    });

    refresh();
    return { ok: "تم نشر الإعلان" };
  } catch (error) {
    return fail(error);
  }
}

export async function toggleAnnouncementAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const actor = await requirePermission("announcements.manage");
    const id = str(fd, "announcementId");
    const announcement = await getAnnouncement(id);
    if (!announcement) return { error: "الإعلان غير موجود" };

    const active = announcement.active === 1 ? 0 : 1;
    await updateAnnouncement(id, { active });

    await audit({
      actor,
      action: active ? "announcement.activated" : "announcement.deactivated",
      targetType: "announcement",
      targetId: id,
      targetLabel: announcement.title,
      before: { active: announcement.active },
      after: { active },
    });

    refresh();
    return { ok: active ? "تم تفعيل الإعلان" : "تم إيقاف الإعلان" };
  } catch (error) {
    return fail(error);
  }
}

export async function deleteAnnouncementAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const actor = await requirePermission("announcements.manage");
    const id = str(fd, "announcementId");
    const announcement = await getAnnouncement(id);
    if (!announcement) return { error: "الإعلان غير موجود" };

    await deleteAnnouncement(id);
    await audit({
      actor,
      action: "announcement.deleted",
      targetType: "announcement",
      targetId: id,
      targetLabel: announcement.title,
      before: { severity: announcement.severity, active: announcement.active },
    });

    refresh();
    return { ok: "تم حذف الإعلان" };
  } catch (error) {
    return fail(error);
  }
}

/** Dismissal is per customer and needs no permission beyond being signed in. */
export async function dismissAnnouncementAction(fd: FormData) {
  const user = await requireUser();
  await markAnnouncementRead(str(fd, "announcementId"), user.id);
  revalidatePath("/dashboard");
}
