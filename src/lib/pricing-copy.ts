import "server-only";
import { brandAsset } from "./brand";
import { FREE_LIMITS, inChargeCurrency, planDefinitions, riyals, yearlySaving } from "./billing";
import { dict } from "./i18n";
import type { PricingCopy } from "@/components/pricing";
import type { Locale } from "./types";

/** Every figure the pricing UI shows, derived once from the plan definitions. */
export async function pricingCopy(locale: Locale): Promise<PricingCopy>{
  const plans = await planDefinitions();
  const saving = await yearlySaving();
  const limits = await FREE_LIMITS();
  const monthlyCharge = await inChargeCurrency(plans.monthly.amount);
  const yearlyCharge = await inChargeCurrency(plans.yearly.amount);

  return {
    d: dict(locale).pricing,
    locale,
    riyalSrc: brandAsset("riyal"),
    monthlyPrice: riyals(plans.monthly.amount),
    yearlyPrice: riyals(plans.yearly.amount),
    yearlyPerMonth: riyals(plans.yearly.amount / 12),
    twelveMonths: riyals(saving.twelveMonths),
    saved: riyals(saving.saved),
    savedPercent: saving.percentLabel,
    freeProjects: limits.maxProjects,
    freeSlides: limits.maxSlides,
    chargeCurrency: monthlyCharge.currency,
    monthlyCharged: monthlyCharge.display,
    yearlyCharged: yearlyCharge.display,
  };
}
