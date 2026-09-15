"use client";

import { usePathname } from "next/navigation";
import { setLocaleAction } from "@/app/actions/auth";
import { LOCALE_LABEL, LOCALES } from "@/lib/i18n";
import type { Locale } from "@/lib/types";

export function LocaleSwitch({ locale }: { locale: Locale }) {
  const pathname = usePathname();

  return (
    <form action={setLocaleAction} className="panel inline-flex gap-0.5 p-0.5">
      <input type="hidden" name="path" value={pathname} />
      {LOCALES.map((option) => (
        <button
          key={option}
          type="submit"
          name="locale"
          value={option}
          lang={option}
          className={`rounded-[13px] px-2.5 py-1.5 text-[12px] font-medium transition ${
            locale === option
              ? "bg-white/10 text-white"
              : "text-mist-500 hover:text-white"
          }`}
        >
          {option === "ar" ? "ع" : "EN"}
          <span className="sr-only"> {LOCALE_LABEL[option]}</span>
        </button>
      ))}
    </form>
  );
}
