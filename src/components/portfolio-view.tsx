import { HeroSlider } from "./hero-slider";
import { ShareButton } from "./share-button";
import { Wordmark } from "./brand/logo";
import { TrackEvents } from "./track-events";
import { ReportDialog } from "./report-dialog";
import { SOCIAL_META, STAT_ICONS, Whatsapp } from "./icons";
import { DIR, dict } from "@/lib/i18n";
import { safeUrl, socialHref } from "@/lib/safe-url";
import type { PortfolioBundle } from "@/lib/types";

function waHref(number: string) {
  const digits = number.replace(/[^\d]/g, "");
  return digits ? `https://wa.me/${digits}` : "#";
}

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
  showBadge = false,
  live = false,
  reportsOpen = false,
  rules = "",
}: {
  bundle: PortfolioBundle;
  /** Free plans carry a small Designakum credit in the footer. */
  showBadge?: boolean;
  /** True on the real public page — previews must not record analytics. */
  live?: boolean;
  reportsOpen?: boolean;
  rules?: string;
}) {
  const { portfolio, slides, projects, stats, socials } = bundle;
  const locale = portfolio.locale;
  const d = dict(locale).portfolio;

  return (
    <div
      data-theme={portfolio.theme}
      lang={locale}
      dir={DIR[locale]}
      className="@container relative"
    >
      <main className="relative z-10 mx-auto w-full max-w-[540px] px-4 pb-10 pt-5 @5xl:max-w-6xl @5xl:px-8 @5xl:pb-16 @5xl:pt-10">
        <div className="shell p-4 sm:p-6 @5xl:p-9">
          <div className="grid grid-cols-[minmax(0,1fr)] gap-6 @5xl:grid-cols-[minmax(0,340px)_minmax(0,1fr)] @5xl:items-start @5xl:gap-9">
            {/* ---------------------------------------------- identity */}
            <section className="rise min-w-0 @5xl:col-start-1 @5xl:row-start-1">
              <div className="flex items-center gap-3">
                <Avatar
                  url={portfolio.avatar_url}
                  monogram={portfolio.monogram}
                  name={portfolio.name}
                  size={78}
                />
                <div className="flex flex-1 items-center justify-center gap-2 @5xl:justify-start">
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
                        <Icon />
                      </a>
                    );
                  })}
                </div>
                <ShareButton title={portfolio.name} shareLabel={d.share} copiedLabel={d.copied} />
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
                className="rise min-w-0 @5xl:col-start-2 @5xl:row-start-1"
                style={{ animationDelay: "80ms" }}
              >
                <HeroSlider slides={slides} tall />
              </section>
            )}

            {/* ------------------------------ stats · contact · about */}
            <section
              className="rise min-w-0 space-y-5 @5xl:col-start-1 @5xl:row-start-2"
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

              {portfolio.whatsapp && (
                <a
                  href={waHref(portfolio.whatsapp)}
                  target="_blank"
                  rel="noreferrer noopener"
                  data-track="whatsapp"
                  className="btn btn-whatsapp"
                >
                  <span style={{ color: "#25D366" }}>
                    <Whatsapp width={22} height={22} />
                  </span>
                  {portfolio.whatsapp_label || d.whatsapp}
                </a>
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
                    {d.works}
                  </h2>
                  <span className="tnum text-[12.5px] text-mist-500">{d.worksCount(projects.length)}</span>
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

                    const className =
                      "card card-tight lift group block overflow-hidden";

                    const link = safeUrl(project.link);

                    return link ? (
                      <a
                        key={project.id}
                        href={link}
                        target="_blank"
                        rel="noreferrer noopener nofollow ugc"
                        data-track="project"
                        className={className}
                      >
                        {Card}
                      </a>
                    ) : (
                      <div key={project.id} className={className}>
                        {Card}
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
            © {portfolio.footer_note || `${d.rights} — ${portfolio.name}`}{" "}
            {new Date().getFullYear()}
          </p>
          {reportsOpen && (
            <ReportDialog portfolioId={portfolio.id} portfolioName={portfolio.name} rules={rules} />
          )}
          {showBadge && (
            <a
              href="/"
              className="panel inline-flex items-center gap-2 px-3 py-2 text-[11.5px] text-mist-500 transition hover:text-mist-300"
            >
              <Wordmark height={13} className="opacity-70" />
              <span>{d.poweredBy}</span>
            </a>
          )}
        </footer>
      </main>
    </div>
  );
}
