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
  /** How tall the device is, before any scaling. */
  height = "78dvh",
}: {
  children: React.ReactNode;
  height?: string;
}) {
  const [scale, setScale] = useState(1);
  const shell = useRef<HTMLDivElement>(null);

  const fit = useCallback(() => {
    const available = shell.current?.clientWidth ?? 0;
    if (!available) return;
    // Never enlarged: a phone blown up past its own size looks like a mistake.
    setScale(Math.min(1, available / DEVICE_WIDTH));
  }, []);

  useEffect(() => {
    fit();
    const node = shell.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(fit);
    observer.observe(node);
    return () => observer.disconnect();
  }, [fit]);

  return (
    <div ref={shell} className="mx-auto w-full">
      {/* A transform does not affect layout, so the box around the device is
          sized from the scale — otherwise the rest of the page sits underneath
          the preview rather than after it. */}
      <div className="mx-auto overflow-hidden" style={{ width: DEVICE_WIDTH * scale, height }}>
        <div
          className="origin-top-left overflow-hidden rounded-[44px] border border-white/12 bg-ink-950 p-2.5 shadow-[0_50px_100px_-45px_rgba(0,0,0,1)]"
          style={{
            width: DEVICE_WIDTH,
            height: `calc(${height} / ${scale})`,
            transform: `scale(${scale})`,
          }}
        >
          <div className="no-scrollbar h-full overflow-y-auto rounded-[36px]">{children}</div>
        </div>
      </div>
    </div>
  );
}
