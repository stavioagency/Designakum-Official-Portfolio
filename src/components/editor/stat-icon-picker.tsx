"use client";

import { useState } from "react";
import { STAT_ICONS, STAT_ICON_OPTIONS } from "@/components/icons";
import { Ban } from "@/components/icons";
import type { Locale } from "@/lib/types";

/**
 * Picking the mark for a statistic.
 *
 * This was a dropdown of names, which had two faults: it never showed the thing
 * being chosen, and it only ever spoke Arabic — the English label sat unused in
 * the same list. Eighteen icons would have made a worse dropdown still, so the
 * icons are the list, and the name is the accessible label.
 */
export function StatIconPicker({
  name,
  defaultValue,
  locale,
}: {
  name: string;
  defaultValue: string;
  locale: Locale;
}) {
  const [selected, setSelected] = useState(defaultValue);

  return (
    <div className="flex flex-wrap gap-1.5">
      <input type="hidden" name={name} value={selected} />
      {STAT_ICON_OPTIONS.map((option) => {
        const Icon = option.value ? STAT_ICONS[option.value] : Ban;
        const label = locale === "en" ? option.labelEn : option.label;
        const active = selected === option.value;

        return (
          <button
            key={option.value || "none"}
            type="button"
            title={label}
            aria-label={label}
            aria-pressed={active}
            onClick={() => setSelected(option.value)}
            className={`grid h-9 w-9 place-items-center rounded-xl border transition ${
              active
                ? "border-white/35 bg-white/10 text-white"
                : "border-white/8 bg-white/[0.03] text-mist-500 hover:bg-white/[0.07] hover:text-mist-300"
            }`}
          >
            <Icon className="h-[18px] w-[18px]" />
          </button>
        );
      })}
    </div>
  );
}
