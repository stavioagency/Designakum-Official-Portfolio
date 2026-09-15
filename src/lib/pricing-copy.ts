import "server-only";
import { brandAsset } from "./brand";
import { FREE_LIMITS, inChargeCurrency, planDefinitions, riyals, yearlySaving } from "./billing";
import { dict } from "./i18n";
import type { PricingCopy } from "@/components/pricing";
import type { Locale } from "./types";

/** Every figure the pricing UI shows, derived once from the plan definitions. */
export function pricingCopy(locale: Locale): PricingCopy {
  const plans = planDefinitions();
  const saving = yearlySaving();
  const limits = FREE_LIMITS();

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
    chargeCurrency: inChargeCurrency(plans.monthly.amount).currency,
    monthlyCharged: inChargeCurrency(plans.monthly.amount).display,
    yearlyCharged: inChargeCurrency(plans.yearly.amount).display,
  };
}
