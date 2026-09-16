import Link from "next/link";
import { Riyal } from "./riyal";
import { Check, Sparkle } from "./icons";
import { fill, type Dictionary } from "@/lib/i18n";
import type { Locale, Plan } from "@/lib/types";

export interface PricingCopy {
  d: Dictionary["pricing"];
  locale: Locale;
  riyalSrc: string | null;
  /** Rendered figures, computed once on the server from the plan definitions. */
  monthlyPrice: string;
  yearlyPrice: string;
  yearlyPerMonth: string;
  twelveMonths: string;
  saved: string;
  savedPercent: string;
  /** The provider settles in this currency; the riyal price is still the real price. */
  chargeCurrency: string;
  monthlyCharged: string;
  yearlyCharged: string;
}

function Price({
  amount,
  suffix,
  riyalSrc,
  locale,
  charged,
  currency,
}: {
  amount: string;
  suffix: string;
  riyalSrc: string | null;
  locale: Locale;
  charged?: string;
  currency?: string;
}) {
  return (
    <div>
      <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="tnum text-[46px] font-bold leading-none">{amount}</span>
        <Riyal src={riyalSrc} locale={locale} size="1.5rem" className="translate-y-[3px]" />
        <span className="text-[13.5px] text-mist-400">/ {suffix}</span>
      </p>
      {charged && currency && currency !== "SAR" && (
        <p className="tnum mt-2 text-[12px] text-mist-500">
          {locale === "ar"
            ? `يُحصّل ${charged} ${currency} عبر بوابة الدفع`
            : `Billed as ${charged} ${currency} at checkout`}
        </p>
      )}
    </div>
  );
}

export function Pricing({
  copy,
  currentPlan,
  ctaHref = "/signup",
  heading = true,
  monthlyCta,
  yearlyCta,
}: {
  copy: PricingCopy;
  currentPlan?: Plan;
  ctaHref?: string;
  heading?: boolean;
  /** Replaces the default link — used on the billing page, where the CTA starts checkout. */
  monthlyCta?: React.ReactNode;
  yearlyCta?: React.ReactNode;
}) {
  const { d, locale, riyalSrc } = copy;

  const planCta = (plan: Plan, highlighted: boolean) => {
    if (currentPlan === plan) {
      return (
        <span className="btn btn-ghost w-full cursor-default opacity-80">
          <Check className="h-4 w-4" />
          {d.currentPlan}
        </span>
      );
    }
    return (
      <Link
        href={`${ctaHref}${ctaHref.includes("?") ? "&" : "?"}plan=${plan}`}
        className={`btn w-full ${highlighted ? "btn-primary" : "btn-ghost"}`}
      >
        {d.cta}
      </Link>
    );
  };

  return (
    <section id="pricing" className="scroll-mt-24">
      {heading && (
        <header className="text-center">
          <h2 className="text-2xl font-bold sm:text-3xl">{d.title}</h2>
          <p className="mx-auto mt-3 max-w-md text-[14.5px] leading-[1.9] text-mist-400">{d.sub}</p>
        </header>
      )}

      <div className="mx-auto mt-9 grid max-w-3xl gap-4 sm:grid-cols-2 sm:items-stretch">
        {/* ----------------------------------------------------------- monthly */}
        <article className="card lift flex flex-col p-6 sm:p-7">
          <h3 className="text-[15px] font-semibold text-mist-300">{d.monthly}</h3>
          <div className="mt-4">
            <Price
              amount={copy.monthlyPrice}
              suffix={d.perMonth}
              riyalSrc={riyalSrc}
              locale={locale}
              charged={copy.monthlyCharged}
              currency={copy.chargeCurrency}
            />
          </div>
          <p className="mt-3 text-[13px] leading-relaxed text-mist-400">{d.monthlyNote}</p>

          <ul className="mt-6 space-y-2.5">
            {d.features.map((feature) => (
              <li key={feature} className="flex items-start gap-2.5 text-[13.5px] text-mist-300">
                <Check className="mt-[3px] h-4 w-4 shrink-0 text-mist-500" />
                {feature}
              </li>
            ))}
          </ul>

          <div className="mt-auto pt-6">{monthlyCta ?? planCta("monthly", false)}</div>
        </article>

        {/* ------------------------------------------------------------ yearly */}
        <article className="card lift accent-glow relative flex flex-col overflow-hidden p-6 sm:p-7">
          <span
            className="accent-grad absolute inset-x-0 top-0 h-[3px]"
            aria-hidden
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-[15px] font-semibold">{d.yearly}</h3>
            <span className="accent-grad flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11.5px] font-bold text-white">
              <Sparkle className="h-3.5 w-3.5" />
              {d.recommended}
            </span>
          </div>

          <div className="mt-4">
            <Price
              amount={copy.yearlyPrice}
              suffix={d.perYear}
              riyalSrc={riyalSrc}
              locale={locale}
              charged={copy.yearlyCharged}
              currency={copy.chargeCurrency}
            />
          </div>

          <p className="accent-text mt-3 flex items-center gap-1.5 text-[13px] font-semibold">
            <span>{d.savePrefix}</span>
            <span className="tnum">{copy.saved}</span>
            <Riyal src={riyalSrc} locale={locale} size="0.95em" />
            <span>{fill(d.savePercent, { percent: copy.savedPercent })}</span>
          </p>
          <p className="mt-1.5 text-[12.5px] leading-relaxed text-mist-400">
            {fill(d.yearlyNote, { total: copy.twelveMonths })}
          </p>
          <p className="mt-2 flex items-center gap-1.5 text-[12.5px] text-mist-500">
            ≈ <span className="tnum font-semibold text-mist-300">{copy.yearlyPerMonth}</span>
            <Riyal src={riyalSrc} locale={locale} size="0.85em" />
            <span>/ {d.perMonth}</span>
          </p>

          <ul className="mt-6 space-y-2.5">
            {d.features.map((feature) => (
              <li key={feature} className="flex items-start gap-2.5 text-[13.5px] text-mist-200">
                <Check className="mt-[3px] h-4 w-4 shrink-0" style={{ color: "var(--accent-ring)" }} />
                {feature}
              </li>
            ))}
          </ul>

          <div className="mt-auto pt-6">{yearlyCta ?? planCta("yearly", true)}</div>
        </article>
      </div>

      <p className="mx-auto mt-5 max-w-lg text-center text-[12.5px] leading-relaxed text-mist-500">
        <span className="font-semibold text-mist-400">{d.freeTitle}:</span> {d.freeBody}
      </p>
    </section>
  );
}
