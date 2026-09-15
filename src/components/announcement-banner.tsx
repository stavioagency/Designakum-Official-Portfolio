"use client";

import { useActionState } from "react";
import { dismissAnnouncementAction } from "@/app/actions/announcements";
import { AlertTriangle, Check, Megaphone, X } from "@/components/icons";
import type { Announcement, AnnouncementSeverity, Locale } from "@/lib/types";

const STYLE: Record<AnnouncementSeverity, { border: string; text: string; Icon: typeof Megaphone }> = {
  info: { border: "border-white/12 bg-white/[0.04]", text: "text-mist-300", Icon: Megaphone },
  success: { border: "border-emerald-400/25 bg-emerald-400/[0.07]", text: "text-emerald-200", Icon: Check },
  warning: { border: "border-amber-400/25 bg-amber-400/[0.07]", text: "text-amber-200", Icon: AlertTriangle },
  critical: { border: "border-rose-500/30 bg-rose-500/[0.09]", text: "text-rose-200", Icon: AlertTriangle },
};

function Dismiss({ id, label }: { id: string; label: string }) {
  const [, action] = useActionState(
    async (_prev: null, fd: FormData) => {
      await dismissAnnouncementAction(fd);
      return null;
    },
    null,
  );

  return (
    <form action={action}>
      <input type="hidden" name="announcementId" value={id} />
      <button
        type="submit"
        aria-label={label}
        className="grid h-7 w-7 place-items-center rounded-lg text-current opacity-60 transition hover:opacity-100"
      >
        <X className="h-4 w-4" />
      </button>
    </form>
  );
}

export function AnnouncementBanner({
  announcements,
  locale,
  dismissLabel,
}: {
  announcements: Announcement[];
  locale: Locale;
  dismissLabel: string;
}) {
  // Falls back to the original when the owner wrote only one language.
  const say = (original: string, english: string) =>
    locale === "en" ? english.trim() || original : original;

  if (!announcements.length) return null;

  return (
    <div className="mb-5 space-y-2.5">
      {announcements.map((announcement) => {
        const style = STYLE[announcement.severity];
        return (
          <div
            key={announcement.id}
            className={`flex items-start gap-3 rounded-2xl border px-4 py-3.5 ${style.border}`}
          >
            <style.Icon className={`mt-0.5 h-[18px] w-[18px] shrink-0 ${style.text}`} />
            <div className="min-w-0 flex-1">
              <p className={`text-[13.5px] font-semibold ${style.text}`}>{say(announcement.title, announcement.title_en)}</p>
              {say(announcement.body, announcement.body_en) && (
                <p className="mt-1 whitespace-pre-wrap text-[12.5px] leading-relaxed text-mist-400">
                  {say(announcement.body, announcement.body_en)}
                </p>
              )}
            </div>
            <Dismiss id={announcement.id} label={dismissLabel} />
          </div>
        );
      })}
    </div>
  );
}
