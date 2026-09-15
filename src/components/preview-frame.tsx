"use client";

import { useState } from "react";

const MODES = [
  { key: "mobile", label: "جوال", width: 430 },
  { key: "desktop", label: "سطح المكتب", width: 0 },
] as const;

export function PreviewFrame({ children }: { children: React.ReactNode }) {
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
              {m.label}
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
        <div className={width ? "no-scrollbar max-h-[78dvh] overflow-y-auto rounded-[36px]" : ""}>
          {children}
        </div>
      </div>
    </div>
  );
}
