"use client";

import { useState } from "react";
import { Check, Share } from "./icons";

export function ShareButton({
  title,
  shareLabel,
  copiedLabel,
}: {
  title: string;
  shareLabel: string;
  copiedLabel: string;
}) {
  const [copied, setCopied] = useState(false);

  async function onShare() {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
        return;
      } catch {
        /* the user dismissed the sheet — fall through to copying */
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable (insecure origin) — nothing useful to do */
    }
  }

  return (
    <button onClick={onShare} className="icon-btn relative" aria-label={shareLabel}>
      {copied ? <Check /> : <Share />}
      {copied && (
        <span className="glass absolute top-full mt-2 whitespace-nowrap rounded-xl px-3 py-1.5 text-[11px] font-medium text-white start-0">
          {copiedLabel}
        </span>
      )}
    </button>
  );
}
