import Link from "next/link";
import { currentUser } from "@/lib/auth";
import { listPortfolios, loadBundle } from "@/lib/portfolios";
import { currentLocale } from "@/lib/locale";
import { dict } from "@/lib/i18n";
import { pricingCopy } from "@/lib/pricing-copy";
import { entitlementsFor } from "@/lib/billing";
import { maintenanceState } from "@/lib/maintenance";
import { readSettings } from "@/lib/settings";
import { MaintenanceNotice } from "@/components/maintenance-notice";
import { BRAND } from "@/lib/brand";
import { LogoLockup, Wordmark } from "@/components/brand/logo";
import { LocaleSwitch } from "@/components/locale-switch";
import { Pricing } from "@/components/pricing";
import { PreviewFrame } from "@/components/preview-frame";
import { PortfolioView } from "@/components/portfolio-view";
import { Briefcase, Globe, Eye, Image as ImageIcon, Pencil, Shield, Sparkle } from "@/components/icons";


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
  const copy = await pricingCopy(locale);

  // One published portfolio, loaded in full, to show the product rather than
  // describe it. Gated on the same setting the old showcase used.
  //
  // Preferring one written in the reader's own language matters more here than
  // anywhere else on the page: this is the example of what they are buying, and
  // an Arabic visitor shown an English page learns the wrong thing about it.
  const showcase = settings["features.public_showcase"]
    ? (await listPortfolios()).filter((p) => p.published === 1 && p.suspended === 0)
    : [];
  // The owner names the page that sells the product. Without that this took
  // whichever portfolio sorted first, which is how the section headed "this is
  // what your page looks like" came to be showing one with a single link on it.
  const chosen = settings["landing.showcase_slug"];
  const featured =
    showcase.find((p) => p.slug === chosen) ??
    showcase.find((p) => p.locale === locale) ??
    showcase[0];
  const preview = featured ? await loadBundle(featured) : null;

  return (
    <div className="relative z-10">
      <header className="mx-auto flex h-20 w-full max-w-6xl items-center justify-between gap-4 px-5">
        <LogoLockup size={40} />
        <nav className="flex items-center gap-2">
          <LocaleSwitch locale={locale} />
          <Link href="#pricing" className="hidden rounded-xl px-3 py-2 text-[13.5px] text-mist-400 transition hover:text-white sm:block">
            {d.nav.pricing}
          </Link>
          {user ? (
            <Link href={user.role === "client" ? "/dashboard" : "/console"} className="btn btn-primary !py-2.5">
              {d.nav.dashboard}
            </Link>
          ) : (
            <>
              <Link href="/login" className="btn btn-ghost !py-2.5">{d.nav.login}</Link>
              <Link href="/signup" className="btn btn-primary !py-2.5">{d.nav.start}</Link>
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
        <section className="rise grid items-center gap-10 pt-10 sm:pt-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,400px)] lg:gap-14">
          <div className="text-center lg:text-start">
            <p className="panel mb-6 inline-flex items-center gap-2 px-4 py-2 text-[12.5px] text-mist-300">
              <Sparkle className="h-4 w-4" style={{ color: "var(--accent-ring)" }} />
              {d.landing.badge}
            </p>
            <h1 className="text-[38px] font-bold leading-[1.2] sm:text-[52px]">
              {d.landing.headline1}
              <br />
              <span className="accent-text">{d.landing.headline2}</span>
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-[15px] leading-[1.9] text-mist-400 sm:text-base lg:mx-0">
              {d.landing.sub}
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3 lg:justify-start">
              <Link href="/signup" className="btn btn-primary">{d.landing.ctaPrimary}</Link>
              {featured && (
                <Link href={`/p/${featured.slug}`} className="btn btn-ghost">
                  {d.landing.ctaSecondary}
                </Link>
              )}
            </div>
          </div>

          {/* `live` is left false, so a visit to the landing page is never
              counted as a visit to the designer's own page — this is a shop
              window, not traffic they earned. */}
          {preview && (
            <div data-theme={preview.portfolio.theme}>
              <PreviewFrame
                labels={{ mobile: d.landing.mobile, desktop: d.landing.desktop }}
                height="min(560px, 68dvh)"
              >
                <PortfolioView bundle={preview} />
              </PreviewFrame>
            </div>
          )}
        </section>

        <section className="mt-20">
          <h2 className="text-center text-2xl font-bold sm:text-3xl">{d.landing.offerTitle}</h2>
          <div className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {d.features.map((feature, i) => {
              const Icon = FEATURE_ICONS[i] ?? Sparkle;
              return (
                <article
                  key={feature.title}
                  className="card lift rise p-6"
                  style={{ animationDelay: `${i * 60}ms` }}
                >
                  <span
                    className="grid h-11 w-11 place-items-center rounded-2xl"
                    style={{
                      background: "color-mix(in oklab, var(--accent-from) 18%, transparent)",
                      color: "var(--accent-ring)",
                    }}
                  >
                    <Icon className="h-[22px] w-[22px]" />
                  </span>
                  <h3 className="mt-4 text-[16px] font-semibold">{feature.title}</h3>
                  <p className="mt-1.5 text-[13px] text-mist-400">{feature.body}</p>
                </article>
              );
            })}
          </div>
        </section>

        <div className="mt-24">
          <Pricing copy={copy} currentPlan={user ? (await entitlementsFor(user)).plan : undefined} />
        </div>

        <section className="card mt-24 overflow-hidden p-8 text-center sm:p-12">
          <h2 className="text-2xl font-bold sm:text-3xl">{d.landing.finalTitle}</h2>
          <Link href="/signup" className="btn btn-primary mt-7">{d.landing.finalCta}</Link>
        </section>
      </main>

      <footer className="mt-24 border-t border-white/8 py-9">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-3 px-5 text-center">
          <Wordmark height={22} className="opacity-70" />
          <nav className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[12.5px] text-mist-500">
            <Link href="/pricing" className="transition hover:text-mist-300">{d.nav.pricing}</Link>
            <Link href="/legal/terms" className="transition hover:text-mist-300">{d.footer.terms}</Link>
            <Link href="/legal/privacy" className="transition hover:text-mist-300">{d.footer.privacy}</Link>
            <Link href="/legal/rules" className="transition hover:text-mist-300">{d.footer.rules}</Link>
          </nav>
          <p className="text-[12.5px] text-mist-500">
            © {BRAND.nameEn} {new Date().getFullYear()} — {d.brandTagline}
          </p>
        </div>
      </footer>
    </div>
  );
}
