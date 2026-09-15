"use client";

import { useEffect } from "react";

/**
 * Counts interactions on a public portfolio. One delegated listener covers every
 * `data-track` element, and `sendBeacon` means a click that navigates away still
 * gets counted. Views are counted server-side during render.
 */
export function TrackEvents({ portfolioId }: { portfolioId: string }) {
  useEffect(() => {
    function onClick(event: MouseEvent) {
      const target = (event.target as HTMLElement | null)?.closest<HTMLElement>("[data-track]");
      const kind = target?.dataset.track;
      if (!kind) return;

      const payload = JSON.stringify({ portfolioId, kind });
      try {
        if (navigator.sendBeacon) {
          navigator.sendBeacon("/api/track", new Blob([payload], { type: "application/json" }));
        } else {
          void fetch("/api/track", { method: "POST", body: payload, keepalive: true });
        }
      } catch {
        /* analytics must never break the page */
      }
    }

    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [portfolioId]);

  return null;
}
