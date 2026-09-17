import Link from "next/link";
import { Riyal } from "./riyal";
import { Check, Sparkle } from "./icons";
import { fill, type Dictionary } from "@/lib/i18n";
import type { Locale, Plan } from "@/lib/types";

export interface PricingCopy {
  /** The currency the figures are written in, which may not be the one charged. */
  displayCurrency: string;
  /** Text to print beside the number, or null when the riyal artwork is used. */
  unitSymbol: string | null;
  currencyName: string;
  /** True when the figures are a conversion rather than the amount charged. */
  approximate: boolean;
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

/**
 * The symbol beside a figure, in whatever money the figure is written in.
 *
 * It used to be the riyal mark unconditionally, on lines the currency switch
 * converts — so a visitor reading dollars was told the saving was in riyals,
 * and the same figure carried two currencies within one card. The mark is only
 * correct when the riyal is what is being shown.
 */
function Unit({ copy, size }: { copy: PricingCopy; size: string }) {
  if (copy.unitSymbol == null) {
    return <Riyal src={copy.riyalSrc} locale={copy.locale} size={size} />;
  }
  return <span className="font-semibold">{copy.unitSymbol}</span>;
}

function Price({
  amount,
  suffix,
  riyalSrc,
  locale,
  charged,
  currency,
  unitSymbol,
}: {
  amount: string;
  suffix: string;
  riyalSrc: string | null;
  locale: Locale;
  charged?: string;
  currency?: string;
  /** null means the riyal glyph; anything else is printed as written. */
  unitSymbol?: string | null;
}) {
  return (
    <div>
      <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="tnum text-[46px] font-bold leading-none">{amount}</span>
        {unitSymbol == null ? (
          <Riyal src={riyalSrc} locale={locale} size="1.5rem" className="translate-y-[3px]" />
        ) : (
          <span className="text-[19px] font-semibold text-mist-300">{unitSymbol}</span>
        )}
        <span className="text-[13.5px] text-mist-400">/ {suffix}</span>
      </p>
      {/* What actually leaves the account. Everything above may be a
          conversion; this line never is. */}
      {charged && currency && (
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
  aside,
}: {
  copy: PricingCopy;
  currentPlan?: Plan;
  ctaHref?: string;
  heading?: boolean;
  /** Replaces the default link — used on the billing page, where the CTA starts checkout. */
  monthlyCta?: React.ReactNode;
  yearlyCta?: React.ReactNode;
  /** Sits under the heading — the landing page puts the currency switch here. */
  aside?: React.ReactNode;
}) {
  const { d, locale, riyalSrc } = copy;

  /**
   * The currency, written out inside a sentence rather than drawn as a mark.
   *
   * The line used to say "SAR" in every currency, because the word was baked
   * into the translation while the number beside it was converted — so a reader
   * in London was told the yearly total was in riyals. A symbol reads badly
   * mid-sentence, so this is the code, except for the riyal in Arabic, which
   * has a written abbreviation everybody uses.
   */
  const unitText =
    copy.displayCurrency === "SAR" && locale === "ar" ? "ر.س" : copy.displayCurrency;

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
          {/* Before the figures, not after them: a currency chosen underneath
              the plans is chosen after the decision it changes. */}
          {aside && <div className="mt-5 flex justify-center">{aside}</div>}
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
              unitSymbol={copy.unitSymbol}
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
              unitSymbol={copy.unitSymbol}
              locale={locale}
              charged={copy.yearlyCharged}
              currency={copy.chargeCurrency}
            />
          </div>

          {/* The saving is the whole argument for the yearly plan, and it used
              to be a line of small print between two other lines of small
              print. Here it is the second-biggest thing on the card. */}
          <p
            className="accent-text mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-[19px] font-bold"
            style={{ lineHeight: 1.25 }}
          >
            <span>{d.savePrefix}</span>
            <span className="tnum">{copy.saved}</span>
            <Unit copy={copy} size="1.05em" />
            <span>{fill(d.savePercent, { percent: copy.savedPercent })}</span>
          </p>
          <p className="mt-2 text-[12.5px] leading-relaxed text-mist-400">
            {fill(d.yearlyNote, { total: copy.twelveMonths, currency: unitText })}
          </p>
          <p className="mt-2 flex items-center gap-1.5 text-[12.5px] text-mist-500">
            ≈ <span className="tnum font-semibold text-mist-300">{copy.yearlyPerMonth}</span>
            <Unit copy={copy} size="0.85em" />
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
