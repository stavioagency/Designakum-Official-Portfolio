import type { Metadata } from "next";
import { announcementIsLive, listAnnouncements, SEVERITY_LABEL } from "@/lib/announcements";
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

export const metadata: Metadata = { title: "الإعلانات" };
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

  return (
    <>
      <PageHeader
        title="إعلانات المنصة"
        description="رسائل تظهر داخل لوحة كل عميل حتى يغلقها بنفسه."
      />

      <SectionCard title="إعلان جديد" className="mb-4">
        <CreateAnnouncementForm />
      </SectionCard>

      <SectionCard title="كل الإعلانات">
        {announcements.length === 0 ? (
          <EmptyState
            icon={<Megaphone className="h-5 w-5" />}
            title="لا إعلانات بعد"
            body="استخدم الإعلانات لإخبار العملاء بالتحديثات أو أعمال الصيانة أو العروض."
          />
        ) : (
          <ul className="divide-y divide-white/6">
            {announcements.map((announcement) => {
              const live = announcementIsLive(announcement);
              return (
                <li key={announcement.id} className="px-5 py-4">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <Badge tone={SEVERITY_TONE[announcement.severity]}>
                      {SEVERITY_LABEL[announcement.severity]}
                    </Badge>
                    <span className="min-w-0 flex-1 truncate text-[14px] font-semibold">
                      {announcement.title}
                    </span>
                    <Badge tone={live ? "good" : "neutral"}>{live ? "ظاهر الآن" : "غير ظاهر"}</Badge>
                    <AnnouncementControls
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
                    {announcement.starts_at ? `من ${formatDate(announcement.starts_at)}` : "من الآن"}
                    {" · "}
                    {announcement.ends_at ? `حتى ${formatDate(announcement.ends_at)}` : "بلا نهاية"}
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
