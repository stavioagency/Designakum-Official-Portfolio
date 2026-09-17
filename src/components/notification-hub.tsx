"use client";

import { useEffect, useRef, useState } from "react";
import { dismissAnnouncementAction } from "@/app/actions/announcements";
import { AlertTriangle, Bell, Check, Megaphone, X } from "@/components/icons";
import type { Announcement, AnnouncementSeverity, Locale } from "@/lib/types";

type Item = Announcement & { read_at: number | null };

const TONE: Record<AnnouncementSeverity, { dot: string; Icon: typeof Megaphone }> = {
  info: { dot: "bg-mist-400", Icon: Megaphone },
  success: { dot: "bg-emerald-400", Icon: Check },
  warning: { dot: "bg-amber-400", Icon: AlertTriangle },
  critical: { dot: "bg-rose-400", Icon: AlertTriangle },
};

/**
 * Somewhere for announcements to live after they are closed.
 *
 * The banner only carries what is live and undismissed, so closing one used to
 * destroy it — no way back to the thing you half-read on a phone. Here the same
 * notices stay, marked as seen, and the count on the bell is only the ones
 * still unread.
 */
export function NotificationHub({
  items,
  locale,
  copy,
}: {
  items: Item[];
  locale: Locale;
  copy: { title: string; empty: string; seen: string; open: string; dismiss: string };
}) {
  const [open, setOpen] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const unread = items.filter((item) => item.read_at === null).length;

  // A click anywhere else, or Escape, closes it — the two things a person tries
  // without being told to.
  useEffect(() => {
    if (!open) return;
    const onClick = (event: MouseEvent) => {
      if (!panel.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const text = (item: Item) => ({
    title: locale === "en" && item.title_en ? item.title_en : item.title,
    body: locale === "en" && item.body_en ? item.body_en : item.body,
  });

  return (
    <div className="relative" ref={panel}>
      <button
        type="button"
        onClick={() => setOpen((was) => !was)}
        aria-label={copy.open}
        aria-expanded={open}
        className="icon-btn relative"
      >
        <Bell className="h-[18px] w-[18px]" />
        {unread > 0 && (
          <span className="absolute -end-0.5 -top-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-rose-500 px-1 text-[10.5px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute end-0 top-[calc(100%+10px)] z-50 w-[min(92vw,340px)] overflow-hidden rounded-2xl border border-white/10 bg-ink-900/95 shadow-2xl backdrop-blur-xl">
          <div className="border-b border-white/8 px-4 py-3">
            <p className="text-[13.5px] font-semibold">{copy.title}</p>
          </div>

          {items.length === 0 ? (
            <p className="px-4 py-6 text-center text-[13px] text-mist-500">{copy.empty}</p>
          ) : (
            <ul className="max-h-[min(60vh,420px)] divide-y divide-white/6 overflow-y-auto">
              {items.map((item) => {
                const tone = TONE[item.severity] ?? TONE.info;
                const { title, body } = text(item);
                const seen = item.read_at !== null;

                return (
                  <li key={item.id} className={`flex gap-3 px-4 py-3 ${seen ? "opacity-55" : ""}`}>
                    <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${tone.dot}`} />
                    <div className="min-w-0 flex-1">
                      <p className="text-[13.5px] font-semibold leading-snug">{title}</p>
                      {body && (
                        <p className="mt-1 text-[12.5px] leading-relaxed text-mist-400">{body}</p>
                      )}
                      {seen && (
                        <p className="mt-1.5 text-[11px] text-mist-600">{copy.seen}</p>
                      )}
                    </div>

                    {!seen && (
                      <form action={dismissAnnouncementAction}>
                        <input type="hidden" name="announcementId" value={item.id} />
                        <button
                          type="submit"
                          aria-label={copy.dismiss}
                          className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-mist-500 transition hover:text-mist-200"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </form>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
