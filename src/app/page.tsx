import Link from "next/link";
import { CurrencySwitch } from "@/components/currency-switch";
import { visitorCurrency } from "@/lib/visitor-currency";
import { currentUser } from "@/lib/auth";
import { listPortfolios, loadBundle } from "@/lib/portfolios";
import { pickShowcase } from "@/lib/showcase";
import { currentLocale } from "@/lib/locale";
import { dict } from "@/lib/i18n";
import { pricingCopy } from "@/lib/pricing-copy";
import { entitlementsFor } from "@/lib/billing";
import { maintenanceState } from "@/lib/maintenance";
import { readSettings } from "@/lib/settings";
import { MaintenanceNotice } from "@/components/maintenance-notice";
import { BRAND } from "@/lib/brand";
import { LogoLockup, Wordmark } from "@/components/brand/logo";
import { BrandWatermark, WelcomeCalligraphy } from "@/components/brand/ornament";
import { LocaleSwitch } from "@/components/locale-switch";
import { Pricing } from "@/components/pricing";
import { PortfolioView } from "@/components/portfolio-view";
import { ClaimLink } from "@/components/landing/claim-link";
import { Showcase } from "@/components/landing/showcase";
import { requestOrigin } from "@/lib/origin";
import { portfolioQr } from "@/lib/qr";
import { Briefcase, Check, Globe, Eye, Image as ImageIcon, Pencil, Shield, Sparkle } from "@/components/icons";


export const dynamic = "force-dynamic";

const FEATURE_ICONS = [Pencil, ImageIcon, Briefcase, Shield, Eye, Globe];

export default async function LandingPage() {
  const maintenance = await maintenanceState();
  if (maintenance.blocked) {
    return <MaintenanceNotice message={maintenance.message} staff={maintenance.staff} />;
  }

  const [user, locale] = await Promise.all([await currentUser(), await currentLocale()]);
  const settings = await readSettings();
  const d = dict(locale);
  const money = await visitorCurrency();
  const copy = await pricingCopy(locale, money.code);

  /**
   * Real pages, to show the product rather than describe it.
   *
   * Three of them: one example reads as one template, and a visitor cannot tell
   * from a single page whether the product could look like them. Which three is
   * the owner's call, in console settings — see src/lib/showcase.ts for what
   * happens when one of those choices stops being published.
   */
  const published = settings["features.public_showcase"]
    ? (await listPortfolios()).filter((p) => p.published === 1 && p.suspended === 0)
    : [];
  const shortlist = pickShowcase(
    published,
    [
      settings["landing.showcase_slug"],
      settings["landing.showcase_slug_2"],
      settings["landing.showcase_slug_3"],
    ],
    locale,
  );
  const featured = shortlist[0];

  const bundles = await Promise.all(shortlist.map((p) => loadBundle(p)));
  const pages = bundles.filter((b) => b !== null);

  const origin = await requestOrigin();
  const host = origin.replace(/^https?:\/\//, "");
  // A code a reader can point a phone at. Only when there is a real page behind
  // it — a QR that leads nowhere is worse than no QR.
  const qr = featured ? await portfolioQr(`${origin}/p/${featured.slug}`) : null;

  return (
    <div className="relative z-10">
      {/* Four controls and a logo do not fit across a phone: "ابدأ الآن" wrapped
          onto two lines inside its own button. Sign-in leaves at that width —
          it is one tap from the page the other button opens, and the header is
          not where a returning customer looks for it. */}
      <header className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-3 px-5 sm:h-20">
        <LogoLockup size={36} className="sm:hidden" />
        <LogoLockup size={40} className="hidden sm:flex" />
        <nav className="flex items-center gap-2">
          <LocaleSwitch locale={locale} />
          <Link href="#pricing" className="hidden rounded-xl px-3 py-2 text-[13.5px] text-mist-400 transition hover:text-white sm:block">
            {d.nav.pricing}
          </Link>
          {user ? (
            <Link
              href={user.role === "client" ? "/dashboard" : "/console"}
              className="btn btn-primary whitespace-nowrap !py-2.5"
            >
              {d.nav.dashboard}
            </Link>
          ) : (
            <>
              {/* Wrapped rather than given `hidden`: `.btn` sets its own
                  display later in the stylesheet and wins the tie. */}
              <span className="hidden sm:block">
                <Link href="/login" className="btn btn-ghost whitespace-nowrap !py-2.5">
                  {d.nav.login}
                </Link>
              </span>
              <Link href="/signup" className="btn btn-primary whitespace-nowrap !py-2.5">
                {d.nav.start}
              </Link>
            </>
          )}
        </nav>
      </header>

      <main className="mx-auto w-full max-w-6xl px-5 pb-20">
        {/*
          The page beside the promise, not three screens below it.
          The demo used to be its own section, seventy-eight percent of the
          viewport tall, which meant scrolling the marketing page through
          somebody's portfolio and never seeing the two together. Here the claim
          and the thing it describes share the first screen.
        */}
        {/*
          The page beside the promise, not three screens below it.
          The demo used to be its own section, seventy-eight percent of the
          viewport tall, which meant scrolling the marketing page through
          somebody's portfolio and never seeing the two together. Here the claim
          and the thing it describes share the first screen.
        */}
        <section className="rise grid grid-cols-1 items-center gap-10 pt-8 sm:pt-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,430px)] lg:gap-14">
          <div className="text-center lg:text-start">
            <h1 className="display text-balance text-[34px] font-bold leading-[1.2] sm:text-[44px] lg:text-[52px] lg:leading-[1.15]">
              {d.landing.headline1}
              <br />
              <span className="accent-text">{d.landing.headline2}</span>
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-pretty text-[14.5px] leading-[1.85] text-mist-400 sm:mt-5 sm:text-base sm:leading-[1.9] lg:mx-0">
              {d.landing.sub}
            </p>

            {/* Signed in already: the address bar is not an offer they need. */}
            {user ? (
              <div className="mt-8 flex flex-wrap items-center justify-center gap-3 lg:justify-start">
                <Link
                  href={user.role === "client" ? "/dashboard" : "/console"}
                  className="btn btn-primary"
                >
                  {d.nav.dashboard}
                </Link>
              </div>
            ) : (
              <ClaimLink host={host} d={d.landing} />
            )}

            <ul className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[12.5px] text-mist-500 lg:justify-start">
              {d.landing.trust.map((item) => (
                <li key={item} className="flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5" style={{ color: "var(--accent-ring)" }} />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* `live` is left false, so a visit to the landing page is never
              counted as a visit to the designer's own page — this is a shop
              window, not traffic they earned. */}
          {pages.length > 0 && (
            <Showcase
              height="min(580px, 70dvh)"
              note={d.landing.showcaseNote}
              pickLabel={d.landing.showcasePick}
              prevLabel={d.landing.showcasePrev}
              nextLabel={d.landing.showcaseNext}
              pages={pages.map((bundle) => ({
                slug: bundle.portfolio.slug,
                theme: bundle.portfolio.theme,
                label: `${host}/p/${bundle.portfolio.slug}`,
                node: <PortfolioView bundle={bundle} />,
              }))}
            />
          )}
        </section>

        {/*
          One thing said properly, then the rest said plainly.

          This was six identical cards in two rows — same size, same icon chip,
          same everything — which the eye reads as one grey block and skips. The
          claim that matters leads at the size it deserves; the supporting five
          are a list, because a border around every sentence flattens the
          hierarchy rather than creating one.
        */}
        <section className="mt-16 sm:mt-24">
          <h2 className="display text-balance text-center text-[22px] font-bold sm:text-3xl">{d.landing.offerTitle}</h2>

          <div className="mt-9 grid gap-5 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
            <article className="card rise accent-glow relative flex flex-col overflow-hidden p-7 sm:p-9">
              <span className="accent-grad absolute inset-x-0 top-0 h-[3px]" aria-hidden />
              {/* Cropped by the card on two sides, so it reads as the card's own
                  texture rather than a picture placed inside it. */}
              <BrandWatermark
                className="bottom-[-18%] end-[-10%] h-[260px] w-[260px] sm:h-[340px] sm:w-[340px]"
                opacity={0.1}
              />
              <span
                className="relative grid h-12 w-12 place-items-center rounded-2xl"
                style={{
                  background: "color-mix(in oklab, var(--accent-from) 20%, transparent)",
                  color: "var(--accent-ring)",
                }}
              >
                <Globe className="h-6 w-6" />
              </span>
              <h3 className="display relative mt-5 text-balance text-[22px] font-bold leading-snug sm:text-[26px]">
                {d.landing.offerLeadTitle}
              </h3>
              <p className="relative mt-3 max-w-md text-[14px] leading-[1.9] text-mist-400">
                {d.landing.offerLeadBody}
              </p>

              {/* The card is as tall as the list beside it; rather than leave
                  the bottom empty, it ends where the reader is now ready to
                  act. */}
              <div className="relative mt-auto pt-8">
                <Link href="/signup" className="btn btn-primary">
                  {d.landing.ctaPrimary}
                </Link>
              </div>
            </article>

            <ul className="rise divide-y divide-white/8">
              {d.features.map((feature, i) => {
                const Icon = FEATURE_ICONS[i] ?? Sparkle;
                return (
                  <li key={feature.title} className="flex items-start gap-4 py-4 first:pt-0 last:pb-0">
                    <span
                      className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl"
                      style={{
                        background: "color-mix(in oklab, var(--accent-from) 14%, transparent)",
                        color: "var(--accent-ring)",
                      }}
                    >
                      <Icon className="h-[18px] w-[18px]" />
                    </span>
                    <div className="min-w-0">
                      <h3 className="text-[15px] font-semibold">{feature.title}</h3>
                      <p className="mt-1 text-[13px] text-mist-400">{feature.body}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>

        {/* Numbered because this genuinely is a sequence: you cannot share a
            link you have not claimed. */}
        <section className="mt-16 sm:mt-24">
          <h2 className="display text-balance text-center text-[22px] font-bold sm:text-3xl">{d.landing.stepsTitle}</h2>
          <ol className="mt-8 grid gap-6 sm:mt-9 sm:grid-cols-3 sm:gap-5">
            {d.landing.steps.map((step, i) => (
              <li
                key={step.title}
                className="rise flex items-start gap-4 sm:block"
                style={{ animationDelay: `${i * 70}ms` }}
              >
                {/* One column on a phone, so the number sits beside its step
                    rather than floating above a rule with nothing to align to. */}
                <span
                  className="tnum grid h-8 w-8 shrink-0 place-items-center rounded-full border border-white/12 text-[13px] font-bold sm:hidden"
                  style={{ color: "var(--accent-ring)" }}
                >
                  {i + 1}
                </span>

                <div className="hidden sm:block">
                  <span className="tnum text-[13px] font-bold" style={{ color: "var(--accent-ring)" }}>
                    {i + 1}
                  </span>
                  <div className="mt-2 h-px w-full bg-white/10" />
                </div>

                <div className="min-w-0">
                  <h3 className="text-[16px] font-semibold sm:mt-4">{step.title}</h3>
                  <p className="mt-1.5 text-[13.5px] leading-relaxed text-mist-400">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* The switch sits with the heading, not under the plans: it changes the
            figures somebody is reading, so it has to be there before they read
            them. */}
        <div className="mt-16 sm:mt-24">
          <Pricing
            copy={copy}
            currentPlan={user ? (await entitlementsFor(user)).plan : undefined}
            aside={
              <CurrencySwitch
                current={money.code}
                locale={locale}
                label={d.pricing.currencyLabel}
              />
            }
          />
        </div>

        {/*
          The same greeting that meets a first-time visitor at the language gate
          closes the page. It is the brand's own voice rather than a translated
          line, so it stays Arabic in both languages.
        */}
        <section className="card relative mt-16 grid items-center gap-8 overflow-hidden p-7 text-center sm:mt-24 sm:p-12 lg:grid-cols-[minmax(0,1fr)_auto] lg:text-start">
          <BrandWatermark
            className="-bottom-20 end-[-8%] h-[300px] w-[300px] sm:h-[420px] sm:w-[420px]"
            opacity={0.09}
          />

          <div className="relative">
            <div className="flex justify-center lg:justify-start">
              <WelcomeCalligraphy className="!mx-0 !max-w-[210px] opacity-90 sm:!max-w-[260px]" />
            </div>

            {qr ? (
              <>
                <h2 className="display fine-only mt-6 text-balance text-[22px] font-bold sm:text-3xl">
                  {d.landing.scanTitle}
                </h2>
                <p className="fine-only mx-auto mt-3 max-w-md text-pretty text-[14px] leading-[1.9] text-mist-400 lg:mx-0">
                  {d.landing.scanBody}
                </p>
                <h2 className="display touch-only mt-6 text-balance text-[22px] font-bold sm:text-3xl">
                  {d.landing.finalTitle}
                </h2>
              </>
            ) : (
              <h2 className="display mt-6 text-balance text-[22px] font-bold sm:text-3xl">
                {d.landing.finalTitle}
              </h2>
            )}

            <div className="mt-7 flex flex-col items-center gap-3 sm:flex-row sm:justify-center lg:justify-start">
              <Link href="/signup" className="btn btn-primary w-full sm:w-auto">
                {d.landing.finalCta}
              </Link>
              {/* What the code would have done, for a device that cannot scan
                  its own screen. */}
              {featured && (
                /* Wrapped, because `.btn` declares its own display later in the
                   stylesheet and would win the tie against `touch-only`. */
                <span className="touch-only w-full sm:w-auto">
                  <Link href={`/p/${featured.slug}`} className="btn btn-ghost w-full sm:w-auto">
                    {d.landing.ctaSecondary}
                  </Link>
                </span>
              )}
            </div>
          </div>

          {/* White, always, and at a size a camera can actually resolve — the
              code is only worth putting here if it scans off a screen. */}
          {qr && (
            <div className="fine-only relative mx-auto w-[168px] rounded-3xl bg-white p-3 sm:w-[184px]">
              <div
                className="[&>svg]:block [&>svg]:h-full [&>svg]:w-full"
                aria-hidden
                dangerouslySetInnerHTML={{ __html: qr }}
              />
            </div>
          )}
        </section>

      </main>

      <footer className="mt-16 border-t border-white/8 py-9 sm:mt-24">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-3 px-5 text-center">
          <Wordmark height={26} className="opacity-80" />
          <nav className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[12.5px] text-mist-500">
            <Link href="/pricing" className="transition hover:text-mist-300">{d.nav.pricing}</Link>
            <Link href="/legal/terms" className="transition hover:text-mist-300">{d.footer.terms}</Link>
            <Link href="/legal/privacy" className="transition hover:text-mist-300">{d.footer.privacy}</Link>
            <Link href="/legal/rules" className="transition hover:text-mist-300">{d.footer.rules}</Link>
          </nav>
          <p className="text-[12.5px] text-mist-500">
            © {BRAND.nameEn} {new Date().getFullYear()} · {d.brandTagline}
          </p>
        </div>
      </footer>
    </div>
  );
}
