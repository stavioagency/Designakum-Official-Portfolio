import "server-only";
import { all, get, now, run } from "./db";
import { newId } from "./ids";
import type { Announcement, AnnouncementSeverity } from "./types";

// Re-exported so server callers have one import, while the console form takes
// them straight from the pure module.
export { ANNOUNCEMENT_HOURS, endsAtFromHours } from "./announcement-durations";

export const SEVERITIES: AnnouncementSeverity[] = ["info", "success", "warning", "critical"];

const SEVERITY_LABEL_AR: Record<AnnouncementSeverity, string> = {
  info: "معلومة",
  success: "خبر جيد",
  warning: "تنبيه",
  critical: "حرج",
};

const SEVERITY_LABEL_EN: Record<AnnouncementSeverity, string> = {
  info: "Information",
  success: "Good news",
  warning: "Warning",
  critical: "Critical",
};

/** An announcement's kind in the reader's language. */
export const severityLabel = (severity: AnnouncementSeverity, locale: string) =>
  (locale === "en" ? SEVERITY_LABEL_EN : SEVERITY_LABEL_AR)[severity] ?? severity;

export async function createAnnouncement(input: {
  title: string;
  body: string;
  titleEn?: string;
  bodyEn?: string;
  severity: AnnouncementSeverity;
  startsAt: number | null;
  endsAt: number | null;
  createdBy: string;
}): Promise<Announcement>{
  const ts = now();
  const id = newId("ann");
  await run(
    `INSERT INTO announcements (id, title, body, title_en, body_en, severity, active,
       starts_at, ends_at, created_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?)`,
    id,
    input.title,
    input.body,
    input.titleEn ?? "",
    input.bodyEn ?? "",
    input.severity,
    input.startsAt,
    input.endsAt,
    input.createdBy,
    ts,
    ts,
  );
  return (await get<Announcement>("SELECT * FROM announcements WHERE id = ?", id))!;
}

export async function updateAnnouncement(
  id: string,
  patch: Partial<Pick<Announcement, "title" | "body" | "severity" | "active" | "starts_at" | "ends_at">>,
) {
  const fields = Object.keys(patch) as (keyof typeof patch)[];
  if (!fields.length) return;
  await run(
    `UPDATE announcements SET ${fields.map((f) => `${f} = ?`).join(", ")}, updated_at = ? WHERE id = ?`,
    ...fields.map((f) => patch[f] as string | number | null),
    now(),
    id,
  );
}

export async function deleteAnnouncement(id: string) {
  await run("DELETE FROM announcements WHERE id = ?", id);
}

/** Newest first, capped — announcements are never deleted, only expired. */
export async function listAnnouncements(limit = 100) {
  return await all<Announcement>(
    "SELECT * FROM announcements ORDER BY created_at DESC LIMIT ?",
    Math.min(Math.max(1, limit), 200),
  );
}

export async function getAnnouncement(id: string) {
  return await get<Announcement>("SELECT * FROM announcements WHERE id = ?", id);
}

/** What a signed-in client should see right now, minus anything they dismissed. */
export async function liveAnnouncementsFor(userId: string) {
  const ts = now();
  return await all<Announcement>(
    `SELECT a.* FROM announcements a
      WHERE a.active = 1
        AND (a.starts_at IS NULL OR a.starts_at <= ?)
        AND (a.ends_at IS NULL OR a.ends_at >= ?)
        AND NOT EXISTS (SELECT 1 FROM announcement_reads r
                         WHERE r.announcement_id = a.id AND r.user_id = ?)
      ORDER BY CASE a.severity WHEN 'critical' THEN 0 WHEN 'warning' THEN 1
               WHEN 'success' THEN 2 ELSE 3 END, a.created_at DESC`,
    ts,
    ts,
    userId,
  );
}

/**
 * Everything this client has been shown, dismissed or not.
 *
 * The banner only carries what is live and undismissed, which means a notice
 * disappears the moment it is closed with no way back to it. This is what the
 * bell reads: the same announcements, plus the ones they have already seen, so
 * closing one is tidying rather than destroying.
 */
export async function announcementHistoryFor(userId: string, limit = 30) {
  const ts = now();
  return await all<Announcement & { read_at: number | null }>(
    `SELECT a.*, r.created_at AS read_at
       FROM announcements a
       LEFT JOIN announcement_reads r
         ON r.announcement_id = a.id AND r.user_id = ?
      WHERE a.active = 1
        AND (a.starts_at IS NULL OR a.starts_at <= ?)
      ORDER BY a.created_at DESC
      LIMIT ?`,
    userId,
    ts,
    Math.min(Math.max(1, limit), 100),
  );
}

export async function markAnnouncementRead(announcementId: string, userId: string) {
  await run(
    `INSERT INTO announcement_reads (announcement_id, user_id, created_at) VALUES (?, ?, ?)
     ON CONFLICT(announcement_id, user_id) DO NOTHING`,
    announcementId,
    userId,
    now(),
  );
}

export function announcementIsLive(announcement: Announcement) {
  const ts = now();
  return (
    announcement.active === 1 &&
    (!announcement.starts_at || announcement.starts_at <= ts) &&
    (!announcement.ends_at || announcement.ends_at >= ts)
  );
}
