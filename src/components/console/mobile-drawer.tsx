"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { X } from "@/components/icons";

/**
 * The console's navigation on a phone.
 *
 * Ten sections wrapped into three rows ate the top third of every screen before
 * any content appeared. They are behind a button now — the same place every
 * other app on the phone keeps them.
 *
 * The panel is rendered rather than portalled because the console shell has no
 * backdrop-filter ancestor to be trapped by; the header does, which is why the
 * button and the panel are siblings rather than parent and child.
 */
export function MobileDrawer({
  label,
  closeLabel,
  children,
}: {
  label: string;
  closeLabel: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Navigating is the most common way to leave this panel, and a drawer still
  // sitting open over the page you just asked for is the classic version of
  // this control done badly.
  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={label}
        aria-expanded={open}
        className="icon-btn !h-10 !w-10 lg:hidden"
      >
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
          <path
            d="M4 7h16M4 12h16M4 17h16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      </button>

      {open && (
        <div className="fixed inset-0 z-[80] h-dvh w-screen lg:hidden">
          <button
            type="button"
            aria-label={closeLabel}
            onClick={() => setOpen(false)}
            className="absolute inset-0 h-dvh w-screen bg-black/70 backdrop-blur-sm"
          />

          {/* Anchored to the start edge, which is the right in Arabic — the
              sheet should come from the side the reader's thumb is already on. */}
          <aside className="absolute inset-y-0 start-0 flex h-dvh w-[82%] max-w-[320px] flex-col border-e border-white/10 bg-ink-950 shadow-2xl">
            <div className="flex items-center justify-end p-3">
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={closeLabel}
                className="icon-btn !h-10 !w-10"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="no-scrollbar flex-1 overflow-y-auto px-3 pb-5">{children}</div>
          </aside>
        </div>
      )}
    </>
  );
}
