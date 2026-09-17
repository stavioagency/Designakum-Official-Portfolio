import "server-only";
import { brandAsset } from "./brand";
import { inChargeCurrency, planDefinitions, yearlySaving } from "./billing";
import { CURRENCIES, formatMoney, fromUsd, isConverted, type CurrencyCode } from "./currency";
import { readSettings } from "./settings";
import { dict } from "./i18n";
import type { PricingCopy } from "@/components/pricing";
import type { Locale } from "./types";

/** What to put next to the number. SAR has commissioned artwork; the rest read fine as text. */
const SYMBOL: Partial<Record<CurrencyCode, string>> = {
  USD: "$",
  GBP: "£",
  AUD: "A$",
};

/**
 * Every figure the pricing UI shows, in the reader's own money.
 *
 * The charge is the truth and the conversion is a courtesy: PayPal bills in one
 * currency, so the dollar amount is computed first and everything else is
 * derived from it. That way the converted figure can never drift away from what
 * the card is actually charged, and the page can always say what that is.
 */
export async function pricingCopy(locale: Locale, code: CurrencyCode = "SAR"): Promise<PricingCopy>{
  const plans = await planDefinitions();
  const saving = await yearlySaving();
  const settings = await readSettings();

  const monthlyCharge = await inChargeCurrency(plans.monthly.amount);
  const yearlyCharge = await inChargeCurrency(plans.yearly.amount);

  // Sterling and the Australian dollar float; an owner can correct them without
  // a deploy. The Gulf pegs are set by central banks and are left alone.
  const rates: Partial<Record<CurrencyCode, number>> = {
    GBP: settings["pricing.gbp_per_usd"] || undefined,
    AUD: settings["pricing.aud_per_usd"] || undefined,
  };

  const usdPerHalala = monthlyCharge.amount / plans.monthly.amount;
  const show = (halalas: number) =>
    formatMoney(fromUsd(halalas * usdPerHalala, code, rates), code, locale);

  return {
    d: dict(locale).pricing,
    locale,
    riyalSrc: brandAsset("riyal"),
    displayCurrency: code,
    unitSymbol: SYMBOL[code] ?? (code === "SAR" ? null : code),
    currencyName: locale === "ar" ? CURRENCIES[code].nameAr : CURRENCIES[code].nameEn,
    approximate: isConverted(code),
    monthlyPrice: show(plans.monthly.amount),
    yearlyPrice: show(plans.yearly.amount),
    yearlyPerMonth: show(plans.yearly.amount / 12),
    twelveMonths: show(saving.twelveMonths),
    saved: show(saving.saved),
    savedPercent: saving.percentLabel,
    chargeCurrency: monthlyCharge.currency,
    monthlyCharged: monthlyCharge.display,
    yearlyCharged: yearlyCharge.display,
  };
}
