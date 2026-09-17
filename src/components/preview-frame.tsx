"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * A real page shown at a real size, scaled to fit wherever it is put.
 *
 * Both modes render at the width they are actually describing — a phone at
 * 430px, a screen at 1180px — and are then scaled down to whatever space is
 * available. Rendering at the container's own width instead would make "Screen"
 * a lie: a portfolio drawn 400px wide is a phone layout with a different label
 * on the button.
 *
 * It also has to be scaled rather than merely capped, because this now sits in
 * a column beside the headline. Left to expand, the desktop mode pushed the
 * grid apart and took the hero copy off the page with it.
 */
const MODES = {
  mobile: { width: 430, radius: 44 },
  desktop: { width: 1180, radius: 18 },
} as const;

type Mode = keyof typeof MODES;

export function PreviewFrame({
  children,
  labels,
  /** How tall the frame is allowed to be, before scaling. */
  height = "78dvh",
}: {
  children: React.ReactNode;
  labels: { mobile: string; desktop: string };
  height?: string;
}) {
  const [mode, setMode] = useState<Mode>("mobile");
  const [scale, setScale] = useState(1);
  const shell = useRef<HTMLDivElement>(null);

  const fit = useCallback(() => {
    const available = shell.current?.clientWidth ?? 0;
    if (!available) return;
    // Never enlarged: a phone blown up past its own size looks like a mistake.
    setScale(Math.min(1, available / MODES[mode].width));
  }, [mode]);

  useEffect(() => {
    fit();
    const node = shell.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(fit);
    observer.observe(node);
    return () => observer.disconnect();
  }, [fit]);

  const { width, radius } = MODES[mode];

  return (
    <div>
      <div className="mb-5 flex justify-center">
        <div className="panel inline-flex gap-1 p-1">
          {(Object.keys(MODES) as Mode[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setMode(key)}
              aria-pressed={mode === key}
              className={`rounded-[14px] px-4 py-2 text-[13px] font-medium transition ${
                mode === key ? "accent-grad text-white" : "text-mist-400 hover:text-white"
              }`}
            >
              {labels[key]}
            </button>
          ))}
        </div>
      </div>

      {/*
        The outer element owns the space the scaled device takes up. A transform
        does not affect layout, so without a height set from the scale the page
        below would sit under the preview rather than after it.
      */}
      <div ref={shell} className="mx-auto w-full">
        {/* Reserves the space the scaled device visually occupies. */}
        <div
          className="mx-auto overflow-hidden"
          style={{ width: width * scale, height }}
        >
          <div
            className="origin-top-left overflow-hidden border border-white/12 bg-ink-950 p-2.5 shadow-[0_50px_100px_-45px_rgba(0,0,0,1)]"
            /* Drawn at full size and then shrunk, so a device scaled to a
               third still lays its contents out as that device would. */
            style={{
              width,
              height: `calc(${height} / ${scale})`,
              borderRadius: radius,
              transform: `scale(${scale})`,
            }}
          >
            <div
              className="no-scrollbar h-full overflow-y-auto"
              style={{ borderRadius: Math.max(radius - 8, 8) }}
            >
              {children}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
