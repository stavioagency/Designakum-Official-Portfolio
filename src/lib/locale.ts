import "server-only";
import { cookies } from "next/headers";
import { DEFAULT_LOCALE, isLocale } from "./i18n";
import type { Locale } from "./types";

export const LOCALE_COOKIE = "dk_locale";

/** The visitor's chosen interface language, remembered in a cookie. */
export async function currentLocale(): Promise<Locale> {
  const value = (await cookies()).get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : DEFAULT_LOCALE;
}
