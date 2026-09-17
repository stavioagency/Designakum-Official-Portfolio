"use client";

import { useState } from "react";

const MODES = [
  { key: "mobile", width: 430 },
  { key: "desktop", width: 0 },
] as const;

export function PreviewFrame({
  children,
  labels,
  /**
   * How tall the device is. The default fills most of the viewport, which suits
   * a section that exists to be looked at; beside a headline it has to be
   * shorter than the screen or the copy next to it is pushed out of the first
   * frame, which is the one thing that section cannot afford.
   */
  height = "78dvh",
}: {
  children: React.ReactNode;
  labels: { mobile: string; desktop: string };
  height?: string;
}) {
  const [mode, setMode] = useState<(typeof MODES)[number]["key"]>("mobile");
  const width = MODES.find((m) => m.key === mode)!.width;

  return (
    <div>
      <div className="mb-5 flex justify-center">
        <div className="panel inline-flex gap-1 p-1">
          {MODES.map((m) => (
            <button
              key={m.key}
              onClick={() => setMode(m.key)}
              className={`rounded-[14px] px-4 py-2 text-[13px] font-medium transition ${
                mode === m.key ? "accent-grad text-white" : "text-mist-400 hover:text-white"
              }`}
            >
              {labels[m.key]}
            </button>
          ))}
        </div>
      </div>

      <div
        className={`mx-auto overflow-hidden transition-all duration-500 ${
          width ? "rounded-[44px] border border-white/12 bg-ink-950 p-2.5 shadow-[0_50px_100px_-45px_rgba(0,0,0,1)]" : ""
        }`}
        style={{ maxWidth: width || "100%" }}
      >
        <div
          className={width ? "no-scrollbar overflow-y-auto rounded-[36px]" : ""}
          style={width ? { maxHeight: height } : undefined}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
