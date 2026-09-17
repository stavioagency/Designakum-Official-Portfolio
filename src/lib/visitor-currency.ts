import "server-only";
import { cookies, headers } from "next/headers";
import { currencyForCountry, isCurrency, type CurrencyCode } from "./currency";
import { currentLocale } from "./locale";

export const CURRENCY_COOKIE = "dk_currency";

/**
 * Which currency to show this visitor, and why.
 *
 * Their own choice first, then where the edge says they are. Geolocation is a
 * guess — a VPN, a work laptop routed through another country, somebody on
 * holiday — so it decides the default and never the answer. A visitor who
 * changes it is telling us something the network cannot.
 */
export async function visitorCurrency(): Promise<{ code: CurrencyCode; chosen: boolean }> {
  const chosen = (await cookies()).get(CURRENCY_COOKIE)?.value;
  if (chosen && isCurrency(chosen)) return { code: chosen, chosen: true };

  // Vercel attaches this at the edge, and it is absent in development and on
  // any other host.
  const country = (await headers()).get("x-vercel-ip-country");
  if (country) return { code: currencyForCountry(country), chosen: false };

  // With no signal at all, the language is the next best one. This platform is
  // Saudi and its prices are set in riyals, so an Arabic reader seeing dollars
  // would be the odd result — while an English reader seeing the currency the
  // card is actually charged in is exactly right.
  return { code: (await currentLocale()) === "ar" ? "SAR" : "USD", chosen: false };
}
