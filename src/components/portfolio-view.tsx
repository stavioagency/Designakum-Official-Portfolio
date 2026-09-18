import Link from "next/link";
import { HeroSlider } from "./hero-slider";
import { Wordmark } from "./brand/logo";
import { ShareButton } from "./share-button";
import { TrackEvents } from "./track-events";
import { ReportDialog } from "./report-dialog";
import { BUTTON_META, SOCIAL_META, STAT_ICONS } from "./icons";
import { DIR, dict, fill } from "@/lib/i18n";
import type { Dictionary } from "@/lib/i18n";
import { safeUrl, socialHref } from "@/lib/safe-url";
import { accentStyle } from "@/lib/accent";
import { MAX_BUTTONS, buttonHref } from "@/lib/buttons";
import { surfaceStyle } from "@/lib/surface";
import { ProjectDetail } from "./project-detail";
import type { PortfolioBundle, Locale } from "@/lib/types";

function Avatar({
  url,
  monogram,
  name,
  size = 84,
}: {
  url: string;
  monogram: string;
  name: string;
  size?: number;
}) {
  return (
    <div
      className="relative shrink-0 rounded-full p-[2px]"
      style={{
        width: size,
        height: size,
        backgroundImage: "linear-gradient(140deg, var(--accent-ring), transparent 55%, var(--accent-to))",
      }}
    >
      <div className="grid h-full w-full place-items-center overflow-hidden rounded-full bg-ink-900">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={name} className="h-full w-full object-cover" />
        ) : (
          <span
            className="accent-text font-bold"
            style={{ fontSize: size * 0.42 }}
          >
            {monogram || name.trim().charAt(0) || "F"}
          </span>
        )}
      </div>
    </div>
  );
}

export function PortfolioView({
  bundle,
  live = false,
  reportsOpen = false,
  rules = "",
  reportCopy,
  viewerLocale,
  hideBranding = false,
}: {
  bundle: PortfolioBundle;
  /** True on the real public page — previews must not record analytics. */
  live?: boolean;
  reportsOpen?: boolean;
  rules?: string;
  /**
   * The report dialog is the one thing on this page that does not belong to the
   * designer, so it speaks the visitor's language rather than the portfolio's.
   */
  reportCopy?: Dictionary["report"];
  viewerLocale?: Locale;
  /**
   * Decided by the caller against the live subscription, not by the stored
   * preference alone — a lapsed account shows the line again without anything
   * having to reach in and change what they asked for.
   */
  hideBranding?: boolean;
}) {
  const { portfolio, slides, projects, stats, socials, buttons, projectImages } = bundle;
  const locale = portfolio.locale;
  const d = dict(locale).portfolio;

  /**
   * Two columns only when there is work to put in the second one.
   *
   * The projects are what fills a desktop's width. A page with none of them is
   * a name, a few links and a way to get in touch, and spreading that across
   * two columns leaves a narrow strip of content beside an empty half-screen.
   * Featured images alone do not earn the second column either: they sit at the
   * top of a single column and read as a banner, which is what they are.
   *
   * So with no projects the page stays one centred column at the width it uses
   * on a phone: the same page, read the same way, on any screen.
   */
  const wide = projects.length > 0;

  /** The buttons that resolve to a real link, five at the most. */
  const cta = buttons
    .map((button) => ({ button, href: buttonHref(button.kind, button.value) }))
    .filter((entry): entry is { button: (typeof buttons)[number]; href: string } => entry.href !== null)
    .slice(0, MAX_BUTTONS);

  return (
    <div
      // A custom colour wins over the theme, and is set inline because it is
      // per-portfolio data — it cannot live in a stylesheet written at build time.
      data-theme={portfolio.accent_hex ? undefined : portfolio.theme}
      // The background carries a whole palette with it: every surface is a
      // translucent lift off the page and every text tone is measured against
      // it, so one colour changes all of them. `themed` is what lets those
      // tokens reach the text utilities; without a background nothing is set
      // and the platform's own dark values apply untouched.
      style={{
        ...accentStyle(portfolio.accent_hex),
        ...surfaceStyle(portfolio.background_hex),
        /* A page with no colour of its own still needs a ground, so the glow
           below has something to sit on rather than showing the platform's own
           light through it. */
        ...(portfolio.background_hex ? null : { background: "var(--color-ink-950)" }),
      }}
      lang={locale}
      dir={DIR[locale]}
      className={`@container relative overflow-hidden${portfolio.background_hex ? " themed" : ""}`}
    >
      {/* Behind everything, and behind the glass in particular. */}
      <span className="page-glow" aria-hidden />

      <main
        className={`relative z-10 mx-auto w-full max-w-[540px] px-4 pb-10 pt-5 @5xl:px-8 @5xl:pb-16 @5xl:pt-10${
          wide ? " @5xl:max-w-6xl" : ""
        }`}
      >
        <div className="shell p-4 sm:p-6 @5xl:p-9">
          <div
            className={`grid grid-cols-[minmax(0,1fr)] gap-6 @5xl:items-start @5xl:gap-9${
              wide ? " @5xl:grid-cols-[minmax(0,340px)_minmax(0,1fr)]" : ""
            }`}
          >
            {/* ---------------------------------------------- identity */}
            <section className="rise min-w-0 @5xl:col-start-1 @5xl:row-start-1">
              {/*
                The links wrap to their own line on a phone.
                Laid out inline, this row asks for the avatar (78) plus up to
                five 44px targets plus the share button — about 398px inside the
                311px a 375px phone actually offers, so it overflowed at four
                links, which real portfolios have. `basis-full` drops them to a
                second line below that width; from @5xl they rejoin the row.
              */}
              <div className="flex flex-wrap items-center gap-3">
                <Avatar
                  url={portfolio.avatar_url}
                  monogram={portfolio.monogram}
                  name={portfolio.name}
                  size={78}
                />
                <div className="order-last flex w-full flex-wrap items-center justify-center gap-2 @5xl:order-none @5xl:w-auto @5xl:flex-1 @5xl:justify-start">
                  {socials.slice(0, 5).map((social) => {
                    const meta = SOCIAL_META[social.platform] ?? SOCIAL_META.website;
                    const Icon = meta.Icon;
                    const href = socialHref(social.platform, social.url);
                    // An unusable or unsafe link renders as a dead icon rather
                    // than an anchor a visitor could be tricked into clicking.
                    if (!href) return null;

                    return (
                      <a
                        key={social.id}
                        href={href}
                        target="_blank"
                        rel="noreferrer noopener nofollow ugc"
                        className="icon-btn"
                        data-track="social"
                        aria-label={meta.label}
                        title={meta.label}
                      >
                        {/* Their own colour where they have one; the page's text
                            colour where the mark is monochrome by design. */}
                        <Icon style={meta.colour ? { color: meta.colour } : undefined} />
                      </a>
                    );
                  })}
                </div>
                <span className="ms-auto @5xl:ms-0">
                  <ShareButton title={portfolio.name} shareLabel={d.share} copiedLabel={d.copied} />
                </span>
              </div>

              <div className="mt-6 text-center @5xl:text-start">
                <h1 className="text-[32px] font-bold leading-tight @5xl:text-[38px]">
                  {portfolio.name}
                </h1>
                <p className="mt-1.5 text-[15px] text-mist-400">{portfolio.title}</p>
                {portfolio.tagline && (
                  <p className="accent-text mt-2 text-sm font-semibold">{portfolio.tagline}</p>
                )}
              </div>
            </section>

            {/* ------------------------------------------------- hero */}
            {slides.length > 0 && (
              <section
                /* The second column only exists when there are projects, so on
                   a page without them these images stay in the single column
                   they are drawn in rather than conjuring an empty track. */
                className={`rise min-w-0${wide ? " @5xl:col-start-2 @5xl:row-start-1" : ""}`}
                style={{ animationDelay: "80ms" }}
              >
                <HeroSlider slides={slides} tall />
              </section>
            )}

            {/* ------------------------------ stats · contact · about */}
            <section
              className={`rise min-w-0 space-y-5${wide ? " @5xl:col-start-1 @5xl:row-start-2" : ""}`}
              style={{ animationDelay: "140ms" }}
            >
              {stats.length > 0 && (
                <div
                  className="panel grid px-2 py-4"
                  style={{ gridTemplateColumns: `repeat(${Math.min(stats.length, 3)}, minmax(0,1fr))` }}
                >
                  {stats.slice(0, 3).map((stat, index) => {
                    const Icon = STAT_ICONS[stat.icon];
                    return (
                      <div
                        key={stat.id}
                        className="px-2 text-center"
                        style={
                          index > 0
                            ? { borderInlineStartWidth: 1, borderColor: "rgba(255,255,255,0.08)" }
                            : undefined
                        }
                      >
                        <div className="flex items-center justify-center gap-1.5">
                          {Icon && <Icon className="h-[17px] w-[17px]" style={{ color: "var(--accent-ring)" }} />}
                          <span className="tnum text-[21px] font-bold leading-none">{stat.value}</span>
                        </div>
                        <p className="mt-2 text-[12.5px] text-mist-400">{stat.label}</p>
                      </div>
                    );
                  })}
                </div>
              )}

              {/*
                The call to action, in as many as five parts.
                A button with nothing usable in it is dropped rather than drawn
                dead: on a page whose job is getting in touch, a button that
                goes nowhere costs more than a missing one.
              */}
              {cta.length > 0 && (
                <div className="flex flex-col gap-2.5">
                  {cta.map(({ button, href }) => {
                    const meta = BUTTON_META[button.kind] ?? BUTTON_META.link;
                    const Icon = meta.Icon;
                    // Only a web link leaves for another site; a phone number and
                    // an email address are handed to the device instead, and a
                    // new tab for those opens a blank window behind the dialler.
                    const external = href.startsWith("http");

                    return (
                      <a
                        key={button.id}
                        href={href}
                        data-kind={button.kind}
                        data-track="contact"
                        className="btn btn-cta"
                        {...(external
                          ? { target: "_blank", rel: "noreferrer noopener" }
                          : null)}
                      >
                        <span style={{ color: meta.colour ?? "var(--accent-ring)" }}>
                          <Icon width={22} height={22} />
                        </span>
                        {button.label || d.buttons[button.kind]}
                      </a>
                    );
                  })}
                </div>
              )}

              {portfolio.bio && (
                <div className="panel p-5">
                  <h2 className="mb-2.5 flex items-center gap-2 text-[15px] font-semibold">
                    <span className="accent-grad h-4 w-1 rounded-full" />
                    {d.about}
                  </h2>
                  <p className="text-[14.5px] leading-[1.95] text-mist-300">{portfolio.bio}</p>
                </div>
              )}
            </section>

            {/* --------------------------------------------- projects */}
            {projects.length > 0 && (
              <section
                className="rise min-w-0 @5xl:col-start-2 @5xl:row-start-2"
                style={{ animationDelay: "200ms" }}
              >
                <div className="mb-4 flex items-baseline justify-between">
                  <h2 className="flex items-center gap-2 text-lg font-semibold">
                    <span className="accent-grad h-5 w-1 rounded-full" />
                    {portfolio.works_label || d.works}
                  </h2>
                  <span className="tnum text-[12.5px] text-mist-500">{fill(d.worksCount, { n: projects.length })}</span>
                </div>

                <div className="grid grid-cols-2 gap-3.5 @5xl:grid-cols-3 @5xl:gap-4">
                  {projects.map((project) => {
                    const Card = (
                      <>
                        <div className="relative aspect-square overflow-hidden">
                          {project.image_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={project.image_url}
                              alt={project.title}
                              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.07]"
                            />
                          ) : (
                            <div className="accent-grad h-full w-full opacity-70" />
                          )}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent opacity-80" />
                          {project.category && (
                            <span className="glass absolute end-2 top-2 rounded-lg px-2 py-1 text-[10.5px] font-medium text-white/85">
                              {project.category}
                            </span>
                          )}
                        </div>
                        <div className="p-3">
                          <p className="truncate text-[14px] font-semibold">{project.title}</p>
                          {project.description && (
                            <p className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-mist-500">
                              {project.description}
                            </p>
                          )}
                        </div>
                      </>
                    );

                    /**
                     * The card opens the item rather than leaving for its link.
                     * A thumbnail and two clipped lines are enough to browse and
                     * not enough to decide, and the link is still one press away
                     * inside — where it is labelled, instead of being whatever
                     * happens when you touch a picture.
                     */
                    return (
                      <div
                        key={project.id}
                        className="card card-tight lift group relative block overflow-hidden"
                      >
                        {Card}
                        <ProjectDetail
                          project={{ ...project, link: safeUrl(project.link) ?? "" }}
                          images={projectImages[project.id]}
                          openLabel={d.openProject}
                          closeLabel={d.closeProject}
                          visitLabel={d.visitProject}
                        />
                      </div>
                    );
                  })}
                </div>
              </section>
            )}
          </div>
        </div>

        {live && <TrackEvents portfolioId={portfolio.id} />}

        <footer className="mt-7 flex flex-col items-center gap-3 text-center">
          <p className="text-[12.5px] text-mist-500">
            © {portfolio.footer_note || `${d.rights} · ${portfolio.name}`}{" "}
            {new Date().getFullYear()}
          </p>
          {reportsOpen && reportCopy && (
            <ReportDialog
              portfolioId={portfolio.id}
              portfolioName={portfolio.name}
              rules={rules}
              copy={reportCopy}
              locale={viewerLocale ?? portfolio.locale}
            />
          )}

          {/* Every published portfolio is a shop window for the platform, so it
              signs its own work — quietly, under the customer's own copyright
              line rather than over it. A paying customer may turn it off. */}
          {!hideBranding && (
          <Link
            href="/"
            aria-label={d.poweredBy}
            className="mt-1 inline-flex items-center gap-2 text-[11.5px] text-mist-600 transition hover:text-mist-400"
          >
            {d.madeWith}
            <Wordmark height={13} className="opacity-70" />
          </Link>
          )}
        </footer>
      </main>
    </div>
  );
}
