/**
 * Showing a price in the reader's own money.
 *
 * Display only. PayPal bills this platform's subscriptions in one currency, and
 * pretending otherwise would be a lie told with a currency symbol: a visitor
 * shown "£9.60" who is then charged $12 has been misled, however accurate the
 * arithmetic was. Every converted price is marked approximate and shown beside
 * the exact amount that will actually leave their account.
 *
 * Pure and dependency-free so a test and the browser can both run it.
 */

export type CurrencyCode =
  | "SAR" | "AED" | "KWD" | "BHD" | "OMR" | "QAR"
  | "USD" | "GBP" | "AUD";

export interface Currency {
  code: CurrencyCode;
  /** Minor units. Kuwait, Bahrain and Oman price to three places, not two. */
  decimals: number;
  /**
   * Units of this currency per one US dollar.
   *
   * The Gulf rates are pegs, fixed by the central banks rather than by a market,
   * so they are exact and do not go stale — SAR has sat at 3.75 since 1986.
   * Kuwait pegs to an undisclosed basket rather than to the dollar alone, so its
   * rate drifts slightly and is the one here that is genuinely an approximation.
   * Sterling and the Australian dollar float and are overridable in settings.
   */
  perUsd: number;
  pegged: boolean;
  nameEn: string;
  nameAr: string;
}

export const CURRENCIES: Record<CurrencyCode, Currency> = {
  SAR: { code: "SAR", decimals: 2, perUsd: 3.75,   pegged: true,  nameEn: "Saudi riyal",      nameAr: "ريال سعودي" },
  AED: { code: "AED", decimals: 2, perUsd: 3.6725, pegged: true,  nameEn: "UAE dirham",       nameAr: "درهم إماراتي" },
  QAR: { code: "QAR", decimals: 2, perUsd: 3.64,   pegged: true,  nameEn: "Qatari riyal",     nameAr: "ريال قطري" },
  OMR: { code: "OMR", decimals: 3, perUsd: 0.3845, pegged: true,  nameEn: "Omani rial",       nameAr: "ريال عماني" },
  BHD: { code: "BHD", decimals: 3, perUsd: 0.376,  pegged: true,  nameEn: "Bahraini dinar",   nameAr: "دينار بحريني" },
  KWD: { code: "KWD", decimals: 3, perUsd: 0.307,  pegged: false, nameEn: "Kuwaiti dinar",    nameAr: "دينار كويتي" },
  USD: { code: "USD", decimals: 2, perUsd: 1,      pegged: true,  nameEn: "US dollar",        nameAr: "دولار أمريكي" },
  GBP: { code: "GBP", decimals: 2, perUsd: 0.79,   pegged: false, nameEn: "Pound sterling",   nameAr: "جنيه إسترليني" },
  AUD: { code: "AUD", decimals: 2, perUsd: 1.52,   pegged: false, nameEn: "Australian dollar", nameAr: "دولار أسترالي" },
};

/**
 * Which money a country reads prices in.
 *
 * Only the places whose currency is on the list. Everywhere else falls back to
 * dollars, which is also what the card is actually charged in — so a visitor
 * outside these countries is shown exactly what they will pay, with no
 * conversion and nothing approximate about it.
 */
const COUNTRY_CURRENCY: Record<string, CurrencyCode> = {
  SA: "SAR",
  AE: "AED",
  KW: "KWD",
  BH: "BHD",
  OM: "OMR",
  QA: "QAR",
  GB: "GBP",
  AU: "AUD",
  US: "USD",
};

export const isCurrency = (value: string): value is CurrencyCode =>
  Object.prototype.hasOwnProperty.call(CURRENCIES, value);

/** A two-letter country code from the edge to the currency to show it. */
export function currencyForCountry(country: string | null | undefined): CurrencyCode {
  if (!country) return "USD";
  return COUNTRY_CURRENCY[country.trim().toUpperCase()] ?? "USD";
}

/**
 * Converts from the amount that is actually charged, in dollars.
 *
 * Rounded to the currency's own precision and no further. Rounding to a
 * marketable number — 9.99 and the like — would mean the figure on the page
 * stopped being a conversion of the real charge and started being a different
 * price that we do not take.
 */
export function fromUsd(usd: number, code: CurrencyCode, rates: Partial<Record<CurrencyCode, number>> = {}) {
  const currency = CURRENCIES[code];
  const rate = rates[code] ?? currency.perUsd;
  const factor = 10 ** currency.decimals;
  return Math.round(usd * rate * factor) / factor;
}

/**
 * Latin digits everywhere, including Arabic — the platform uses one numeral
 * system, and a price is the last place to start mixing two.
 */
export function formatMoney(amount: number, code: CurrencyCode, locale: "ar" | "en" = "en") {
  const { decimals } = CURRENCIES[code];
  const tag = locale === "ar" ? "ar-SA-u-nu-latn" : "en-GB";
  return amount.toLocaleString(tag, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/** True when what we show is a conversion rather than the charge itself. */
export const isConverted = (code: CurrencyCode) => code !== "USD";
