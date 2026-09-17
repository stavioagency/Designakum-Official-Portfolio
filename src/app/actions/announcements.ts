"use server";

import { revalidatePath } from "next/cache";
import { messages } from "@/lib/locale";
import { fill } from "@/lib/i18n";
import { audit } from "@/lib/audit";
import { requireUser } from "@/lib/auth";
import {
  createAnnouncement,
  deleteAnnouncement,
  endsAtFromHours,
  getAnnouncement,
  markAnnouncementRead,
  updateAnnouncement,
} from "@/lib/announcements";
import { PermissionError, requirePermission } from "@/lib/permissions";
import type { AnnouncementSeverity } from "@/lib/types";
import type { ActionState } from "./console";
import { reportError } from "@/lib/observability";

const str = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();

async function fail(error: unknown): Promise<ActionState> {
  // A refused permission is an expected outcome, not an incident.
  if (error instanceof PermissionError) return { error: error.message };
  reportError(error, { area: "action" });
  return { error: error instanceof Error ? error.message : (await messages()).failed };
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
    if (title.length < 3) return { error: (await messages()).writeAnnouncementTitle };

    const severity = str(fd, "severity") as AnnouncementSeverity;
    if (!["info", "success", "warning", "critical"].includes(severity)) {
      return { error: (await messages()).unknownKind };
    }

    const announcement = await createAnnouncement({
      title: title.slice(0, 160),
      body: str(fd, "body").slice(0, 2000),
      titleEn: str(fd, "titleEn").slice(0, 160),
      bodyEn: str(fd, "bodyEn").slice(0, 2000),
      severity,
      startsAt: parseDate(str(fd, "startsAt")),
      // A duration beats an end date: it is how the decision is made, and an
      // hour cannot be expressed with a date picker at all.
      endsAt: endsAtFromHours(Number(str(fd, "runHours")), parseDate(str(fd, "startsAt")) ?? Date.now()),
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
    return { ok: (await messages()).announcementPublished };
  } catch (error) {
    return await fail(error);
  }
}

export async function toggleAnnouncementAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const actor = await requirePermission("announcements.manage");
    const id = str(fd, "announcementId");
    const announcement = await getAnnouncement(id);
    if (!announcement) return { error: (await messages()).announcementMissing };

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
    const m = await messages();
    return { ok: active ? m.announcementResumed : m.announcementPaused };
  } catch (error) {
    return await fail(error);
  }
}

/**
 * Changes when a live announcement comes down, at any point after it went up.
 *
 * The duration chosen at publication is a guess about how long the news stays
 * news, and guesses are wrong: something meant for a day turns out to matter for
 * a week, and a notice about an outage should come down the moment it is over.
 * Until now the only ways to shorten one were to pause it or delete it, and
 * there was no way at all to extend one.
 *
 * An empty value means no end — it runs until it is paused by hand.
 */
export async function setAnnouncementEndAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const actor = await requirePermission("announcements.manage");
    const id = str(fd, "announcementId");
    const announcement = await getAnnouncement(id);
    if (!announcement) return { error: (await messages()).announcementMissing };

    const raw = str(fd, "endsAt");
    let endsAt: number | null = null;

    if (raw) {
      // A datetime-local field has no zone, so it is read as the console's own
      // clock — which is the one the person setting it is looking at.
      const parsed = Date.parse(raw);
      if (Number.isNaN(parsed)) return { error: (await messages()).announcementBadDate };
      endsAt = parsed;
    }

    await updateAnnouncement(id, { ends_at: endsAt });

    await audit({
      actor,
      action: "announcement.end_changed",
      targetType: "announcement",
      targetId: id,
      targetLabel: announcement.title,
      before: { ends_at: announcement.ends_at },
      after: { ends_at: endsAt },
    });

    refresh();
    const m = await messages();
    return { ok: endsAt ? m.announcementEndSet : m.announcementNoEnd };
  } catch (error) {
    return await fail(error);
  }
}

export async function deleteAnnouncementAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const actor = await requirePermission("announcements.manage");
    const id = str(fd, "announcementId");
    const announcement = await getAnnouncement(id);
    if (!announcement) return { error: (await messages()).announcementMissing };

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
    return { ok: (await messages()).announcementDeleted };
  } catch (error) {
    return await fail(error);
  }
}

/** Dismissal is per customer and needs no permission beyond being signed in. */
export async function dismissAnnouncementAction(fd: FormData) {
  const user = await requireUser();
  await markAnnouncementRead(str(fd, "announcementId"), user.id);
  revalidatePath("/dashboard");
}
