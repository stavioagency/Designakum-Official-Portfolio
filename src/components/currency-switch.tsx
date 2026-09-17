"use client";

import { setCurrencyAction } from "@/app/actions/currency";
import { CURRENCIES, type CurrencyCode } from "@/lib/currency";
import type { Locale } from "@/lib/types";

/**
 * Lets the reader correct the guess.
 *
 * Geolocation is right most of the time and wrong in exactly the cases that
 * matter to a person — a VPN, a work laptop routed elsewhere, somebody abroad.
 * A visitor who changes this is telling us something the network cannot.
 */
export function CurrencySwitch({
  current,
  locale,
  label,
}: {
  current: CurrencyCode;
  locale: Locale;
  label: string;
}) {
  return (
    <form action={setCurrencyAction} className="flex flex-wrap items-center justify-center gap-2">
      <label className="text-[12.5px] text-mist-500" htmlFor="currency">
        {label}
      </label>
      <select
        id="currency"
        name="currency"
        defaultValue={current}
        onChange={(event) => event.currentTarget.form?.requestSubmit()}
        className="field !w-auto !py-1.5 !text-[13px]"
      >
        {(Object.keys(CURRENCIES) as CurrencyCode[]).map((code) => (
          <option key={code} value={code}>
            {CURRENCIES[code].flag}  {code} · {locale === "ar" ? CURRENCIES[code].nameAr : CURRENCIES[code].nameEn}
          </option>
        ))}
      </select>
      {/* Works without JavaScript too: the select submits on change when it can,
          and this is here for when it cannot. */}
      <noscript>
        <button type="submit" className="btn btn-ghost !py-1.5 !text-[12.5px]">
          {label}
        </button>
      </noscript>
    </form>
  );
}
