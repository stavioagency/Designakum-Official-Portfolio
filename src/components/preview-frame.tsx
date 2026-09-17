"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * A real page in a phone, beside the headline.
 *
 * There used to be a second mode showing a desktop layout, and it could not
 * work here. A desktop page is 1180px wide and this column is about 400, which
 * put it on screen at 34% — body text rendered at 4.9px. That is not something
 * spacing fixes; a page that wide cannot be read in a column that narrow, and a
 * preview nobody can read is worse than no preview, because it is the thing
 * meant to show the product.
 *
 * A phone is also the honest choice. The product is a link people share, and a
 * shared link is opened on a phone.
 */
const DEVICE_WIDTH = 430;

export function PreviewFrame({
  children,
  /** How tall the device is. */
  height = "78dvh",
}: {
  children: React.ReactNode;
  height?: string;
}) {
  const [width, setWidth] = useState(DEVICE_WIDTH);
  const shell = useRef<HTMLDivElement>(null);

  /**
   * The device narrows; the page inside it is never scaled.
   *
   * This used to scale the whole frame down with a transform, which on a 375px
   * screen meant a 430px device at 78% — every glyph resampled, and hairlines
   * landing between pixels. The page inside is built on container queries, so a
   * narrower device simply renders a narrower page, crisply, the way an actual
   * 375px phone would. Real phones run from about 360 to 430 wide, so a frame
   * anywhere in that range is still an honest picture of the product.
   *
   * Measured from the parent, never from ourselves: measuring the shell is a
   * feedback loop with a wrong stable answer — the frame starts at full size, an
   * auto-sized grid track grows to fit it, and that widened track then reads
   * back as the room available, so it stays too big and the page scrolls
   * sideways.
   */
  const fit = useCallback(() => {
    const available = shell.current?.parentElement?.clientWidth ?? 0;
    if (!available) return;
    setWidth(Math.min(DEVICE_WIDTH, available));
  }, []);

  useEffect(() => {
    fit();
    const node = shell.current?.parentElement;
    if (!node || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(fit);
    observer.observe(node);
    return () => observer.disconnect();
  }, [fit]);

  return (
    <div ref={shell} className="mx-auto w-full">
      <div
        className="mx-auto overflow-hidden rounded-[44px] border border-white/12 bg-ink-950 p-2.5 shadow-[0_50px_100px_-45px_rgba(0,0,0,1)]"
        style={{ width, height }}
      >
        <div className="no-scrollbar preview-scroll h-full rounded-[36px]">{children}</div>
      </div>
    </div>
  );
}
