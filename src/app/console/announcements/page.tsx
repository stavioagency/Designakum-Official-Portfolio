import type { Metadata } from "next";
import { currentLocale } from "@/lib/locale";
import { dict, fill } from "@/lib/i18n";
import { announcementIsLive, listAnnouncements, severityLabel } from "@/lib/announcements";
import { guardPage } from "@/lib/permissions";
import {
  Badge,
  EmptyState,
  PageHeader,
  SectionCard,
  formatDate,
} from "@/components/console/ui";
import {
  AnnouncementControls,
  CreateAnnouncementForm,
} from "@/components/console/announcement-forms";
import { Megaphone } from "@/components/icons";
import type { AnnouncementSeverity } from "@/lib/types";

export async function generateMetadata(): Promise<Metadata> {
  return { title: dict(await currentLocale()).console.nav.announcements };
}
export const dynamic = "force-dynamic";

const SEVERITY_TONE: Record<AnnouncementSeverity, "neutral" | "good" | "warn" | "bad"> = {
  info: "neutral",
  success: "good",
  warning: "warn",
  critical: "bad",
};

export default async function AnnouncementsPage() {
  await guardPage("announcements.manage");
  const announcements = await listAnnouncements();
  const locale = await currentLocale();
  const t = dict(locale).console.announcements;
  const dialogChrome = {
    cancel: dict(locale).console.common.cancel,
    pending: dict(locale).console.common.saving,
    confirmParts: [dict(locale).console.common.confirmBefore, dict(locale).console.common.confirmAfter] as [string, string],
  };


  return (
    <>
      <PageHeader
        title={t.title}
        description={t.description}
      />

      <SectionCard title={t.create} className="mb-4">
        <CreateAnnouncementForm copy={t} />
      </SectionCard>

      <SectionCard title={t.all}>
        {announcements.length === 0 ? (
          <EmptyState
            icon={<Megaphone className="h-5 w-5" />}
            title={t.empty}
            body={t.emptyBody}
          />
        ) : (
          <ul className="divide-y divide-white/6">
            {announcements.map((announcement) => {
              const live = announcementIsLive(announcement);
              return (
                <li key={announcement.id} className="px-5 py-4">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <Badge tone={SEVERITY_TONE[announcement.severity]}>
                      {severityLabel(announcement.severity, locale)}
                    </Badge>
                    <span className="min-w-0 flex-1 truncate text-[14px] font-semibold">
                      {announcement.title}
                    </span>
                    <Badge tone={live ? "good" : "neutral"}>{live ? t.live : t.hidden}</Badge>
                    <AnnouncementControls copy={t} dialog={dialogChrome}
                      id={announcement.id}
                      title={announcement.title}
                      active={announcement.active === 1}
                    />
                  </div>

                  {announcement.body && (
                    <p className="mt-2 whitespace-pre-wrap text-[13px] leading-relaxed text-mist-400">
                      {announcement.body}
                    </p>
                  )}

                  <p className="mt-2 text-[11.5px] text-mist-600">
                    {announcement.starts_at
                      ? fill(t.from, { date: formatDate(announcement.starts_at, locale) })
                      : t.fromNow}
                    {" · "}
                    {announcement.ends_at
                      ? fill(t.until, { date: formatDate(announcement.ends_at, locale) })
                      : t.noEnd}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </SectionCard>
    </>
  );
}
