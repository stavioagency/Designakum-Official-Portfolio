/**
 * One published portfolio, rendered the same way whether the visitor arrived at
 * /p/<slug> or at the customer's own domain. The two routes differ only in how
 * they work out which portfolio is being asked for, so everything after that
 * lives here rather than being written twice and drifting apart.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { get } from "@/lib/db";
import { canPublish } from "@/lib/billing";
import { domainsFor } from "@/lib/domains";
import { brandAsset } from "@/lib/brand";
import { getPortfolioBySlug, loadBundle, recordView } from "@/lib/portfolios";
import { callerIsBot } from "@/lib/bots";
import { liftExpiredSuspension } from "@/lib/moderation";
import { isStaff } from "@/lib/permissions";
import { callerFingerprint } from "@/lib/rate-limit";
import { localized, readSettings } from "@/lib/settings";
import { maintenanceState } from "@/lib/maintenance";
import { MaintenanceNotice } from "@/components/maintenance-notice";
import { currentLocale } from "@/lib/locale";
import { dict } from "@/lib/i18n";
import { PortfolioView } from "@/components/portfolio-view";
import { Ban } from "@/components/icons";
import type { User } from "@/lib/types";

/** Metadata for one portfolio, whichever hostname asked for it. */
export async function portfolioMetadata(slug: string): Promise<Metadata> {
  const portfolio = await getPortfolioBySlug(slug);
  if (!portfolio) return { title: "404" };

  // What the owner wrote wins; otherwise the page describes itself from what is
  // already there, which beats a field somebody left half-filled.
  const heading = portfolio.seo_title || `${portfolio.name} — ${portfolio.title}`;
  const description =
    portfolio.seo_description || portfolio.bio.slice(0, 160) || portfolio.tagline;

  // A page that is not actually public answers with a placeholder, and a
  // placeholder in a search index is worse for the designer than no result.
  const owner = await get<User>("SELECT * FROM users WHERE id = ?", portfolio.user_id);
  const live =
    portfolio.published === 1 &&
    portfolio.suspended === 0 &&
    !!owner &&
    owner.status === "active" &&
    (await canPublish(owner));

  /**
   * One page, one canonical URL.
   *
   * A verified custom domain serves this portfolio at its own root, and the
   * middleware rewrites every path on that host to the same page — so the page
   * exists at `theirdomain.com/`, at `theirdomain.com/p/slug`, and again at
   * `designakum.com/p/slug`. Left alone, the canonical pointed at the second of
   * those, which is the one nobody links to. It now names their domain's root
   * when they have one, and the platform URL when they do not, so every copy
   * points at a single address instead of splitting the signal three ways.
   */
  const custom = (await domainsFor(portfolio.id)).find((d) => d.status === "active");
  const canonical = custom ? `https://${custom.hostname}/` : `/p/${portfolio.slug}`;

  const share = portfolio.og_image_url || portfolio.avatar_url;

  return {
    title: heading,
    description,
    robots: live ? undefined : { index: false, follow: false },
    /**
     * Their icon in the tab, not ours.
     *
     * Only when they have uploaded one: leaving it out lets the platform's own
     * icon apply, which is a better answer than an empty square. A page served
     * from a custom domain gets the same treatment, so the tab matches the
     * address.
     */
    icons: portfolio.favicon_url ? { icon: portfolio.favicon_url } : undefined,
    alternates: live ? { canonical } : undefined,
    openGraph: {
      title: heading,
      description,
      type: "profile",
      url: live ? canonical : undefined,
      // Their own card first, then their face; the platform card rather than
      // nothing when a portfolio has uploaded neither.
      images: share ? [share] : (brandAsset("og") ?? undefined),
    },
    twitter: {
      card: "summary_large_image",
      title: heading,
      description,
      images: share ? [share] : undefined,
    },
  };
}

export async function PortfolioPage({ slug }: { slug: string }) {
  let portfolio = await getPortfolioBySlug(slug);
  if (!portfolio) notFound();

  // A temporary suspension expires on its own the first time the page is opened.
  if (await liftExpiredSuspension(portfolio)) portfolio = (await getPortfolioBySlug(slug))!;

  const maintenance = await maintenanceState({ portfolio: true });
  if (maintenance.blocked) {
    return <MaintenanceNotice message={maintenance.message} staff={maintenance.staff} />;
  }

  const viewer = await currentUser();
  const canEdit = !!viewer && (isStaff(viewer) || viewer.id === portfolio.user_id);
  const locale = await currentLocale();
  const d = dict(locale);
  const settings = await readSettings();

  if (portfolio.suspended === 1 && !isStaff(viewer)) {
    return (
      <main className="relative z-10 flex min-h-dvh items-center justify-center px-6 text-center">
        <div className="card max-w-sm p-8">
          <span className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-rose-500/12 text-rose-300">
            <Ban className="h-6 w-6" />
          </span>
          <h1 className="text-xl font-bold">هذا المعرض موقوف مؤقتًا</h1>
          <p className="mt-3 text-sm leading-relaxed text-mist-400">
            أوقف فريق ديزاينكم عرض هذه الصفحة أثناء مراجعة مخالفة لقواعد النشر. محتوى صاحب
            المعرض محفوظ بالكامل.
          </p>
          {canEdit && portfolio.suspended_reason && (
            <p className="panel mt-4 px-3.5 py-3 text-[12.5px] leading-relaxed text-mist-400">
              السبب: {portfolio.suspended_reason}
            </p>
          )}
          <Link href="/" className="btn btn-ghost mt-6 w-full">
            {d.portfolio.home}
          </Link>
        </div>
      </main>
    );
  }

  // The owner's subscription decides whether this page is public at all. Checking
  // it here means a lapse takes effect immediately and re-subscribing restores the
  // page exactly as it was — no batch job, nothing lost.
  const owner = await get<User>("SELECT * FROM users WHERE id = ?", portfolio.user_id);
  const ownerMayPublish = owner ? await canPublish(owner) : false;
  const publiclyVisible = portfolio.published === 1 && ownerMayPublish;

  if (!publiclyVisible && !canEdit) {
    return (
      <main className="relative z-10 flex min-h-dvh items-center justify-center px-6 text-center">
        <div className="card max-w-sm p-8">
          <p className="accent-text text-sm font-semibold">{d.portfolio.soonBadge}</p>
          <h1 className="mt-2 text-2xl font-bold">{d.portfolio.soonTitle}</h1>
          <p className="mt-3 text-sm leading-relaxed text-mist-400">{d.portfolio.soonBody}</p>
          <Link href="/" className="btn btn-ghost mt-6 w-full">{d.portfolio.home}</Link>
        </div>
      </main>
    );
  }

  // Staff previews and crawlers are not audience, so neither is counted.
  if (!canEdit && !(await callerIsBot())) {
    await recordView(portfolio.id, await callerFingerprint());
  }

  return (
    <>
      {/* Only the public page paints the viewport. The hex is the validated
          value from the database — normaliseHex refuses anything that is not
          six hex digits — so there is nothing here to escape. */}
      {portfolio.background_hex && (
        <style>{`html,body{background:${portfolio.background_hex}}`}</style>
      )}
      <PortfolioView
        bundle={await loadBundle(portfolio)}
        live
        reportsOpen={settings["features.reports"]}
        rules={localized(settings, "rules.portfolio", locale)}
        reportCopy={d.report}
        viewerLocale={locale}
        // Both halves have to hold: what they asked for, and whether they are
        // currently entitled to it. `ownerMayPublish` is the live subscription
        // — the same check that decides the page is public at all — so a lapse
        // brings the line back on its own.
        hideBranding={portfolio.hide_branding === 1 && ownerMayPublish}
      />
    </>
  );
}
