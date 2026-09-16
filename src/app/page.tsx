import Link from "next/link";
import { currentUser } from "@/lib/auth";
import { listPortfolios } from "@/lib/portfolios";
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
import { Briefcase, Globe, Eye, Image as ImageIcon, Pencil, Shield, Sparkle } from "@/components/icons";

const STEP_ICONS = [Sparkle, ImageIcon, Globe];

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

  const showcase = settings["features.public_showcase"]
    ? (await listPortfolios())
        .filter((p) => p.published === 1 && p.suspended === 0)
        .slice(0, 6)
    : [];

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
        <section className="rise pt-10 text-center sm:pt-16">
          <p className="panel mx-auto mb-6 inline-flex items-center gap-2 px-4 py-2 text-[12.5px] text-mist-300">
            <Sparkle className="h-4 w-4" style={{ color: "var(--accent-ring)" }} />
            {d.landing.badge}
          </p>
          <h1 className="mx-auto max-w-3xl text-[38px] font-bold leading-[1.25] sm:text-[56px]">
            {d.landing.headline1}
            <br />
            <span className="accent-text">{d.landing.headline2}</span>
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-[15px] leading-[1.9] text-mist-400 sm:text-base">
            {d.landing.sub}
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link href="/signup" className="btn btn-primary">{d.landing.ctaPrimary}</Link>
            {showcase[0] && (
              <Link href={`/p/${showcase[0].slug}`} className="btn btn-ghost">
                {d.landing.ctaSecondary}
              </Link>
            )}
          </div>
        </section>

        {/* Three steps, told with numerals and icons rather than a paragraph. The
            hairline runs behind the badges on wide screens so the row reads as a
            single path instead of three unrelated cards. */}
        <section className="relative mt-20">
          <h2 className="text-center text-2xl font-bold sm:text-3xl">{d.landing.stepsTitle}</h2>
          <ol className="relative mt-9 grid gap-6 sm:grid-cols-3">
            <span
              aria-hidden
              className="absolute inset-x-[16%] top-8 hidden h-px sm:block"
              style={{ background: "linear-gradient(90deg, transparent, var(--hairline) 15%, var(--hairline) 85%, transparent)" }}
            />
            {d.steps.map((step, i) => {
              const Icon = STEP_ICONS[i] ?? Sparkle;
              return (
                <li key={step.title} className="rise relative text-center" style={{ animationDelay: `${i * 90}ms` }}>
                  <span
                    className="relative mx-auto grid h-16 w-16 place-items-center rounded-full border"
                    style={{
                      borderColor: "var(--hairline)",
                      background: "var(--color-ink-850)",
                      color: "var(--accent-ring)",
                    }}
                  >
                    <Icon className="h-6 w-6" />
                    <span className="accent-grad tnum absolute -bottom-1 grid h-6 w-6 place-items-center rounded-full text-[12px] font-bold text-white">
                      {i + 1}
                    </span>
                  </span>
                  <h3 className="mt-5 text-[15.5px] font-semibold">{step.title}</h3>
                  <p className="mt-1 text-[13px] text-mist-400">{step.body}</p>
                </li>
              );
            })}
          </ol>
        </section>

        <section className="mt-20">
          <h2 className="text-center text-2xl font-bold sm:text-3xl">{d.landing.featuresTitle}</h2>
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

        {showcase.length > 0 && (
          <section className="mt-24">
            <h2 className="text-center text-2xl font-bold">{d.landing.showcaseTitle}</h2>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {showcase.map((p) => (
                <Link
                  key={p.id}
                  href={`/p/${p.slug}`}
                  data-theme={p.theme}
                  className="card lift flex items-center gap-4 p-4"
                >
                  <span className="accent-grad grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-2xl font-bold">
                    {p.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.avatar_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      p.name.trim().charAt(0)
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-semibold">{p.name}</span>
                    <span className="block truncate text-[12.5px] text-mist-500">{p.title}</span>
                  </span>
                  <span dir="ltr" className="shrink-0 text-[11.5px] text-mist-500">/p/{p.slug}</span>
                </Link>
              ))}
            </div>
          </section>
        )}

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
