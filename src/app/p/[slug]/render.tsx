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

  const description = portfolio.bio.slice(0, 160) || portfolio.tagline;

  // A page that is not actually public answers with a placeholder, and a
  // placeholder in a search index is worse for the designer than no result.
  const owner = await get<User>("SELECT * FROM users WHERE id = ?", portfolio.user_id);
  const live =
    portfolio.published === 1 &&
    portfolio.suspended === 0 &&
    !!owner &&
    owner.status === "active" &&
    (await canPublish(owner));

  return {
    title: `${portfolio.name} — ${portfolio.title}`,
    description,
    robots: live ? undefined : { index: false, follow: false },
    alternates: live ? { canonical: `/p/${portfolio.slug}` } : undefined,
    openGraph: {
      title: `${portfolio.name} — ${portfolio.title}`,
      description,
      type: "profile",
      // Their own face first; the platform card rather than nothing when a
      // portfolio has not uploaded one yet.
      images: portfolio.avatar_url
        ? [portfolio.avatar_url]
        : (brandAsset("og") ?? undefined),
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
      <main className="relative z-10 grid min-h-dvh place-items-center px-6 text-center">
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
      <main className="relative z-10 grid min-h-dvh place-items-center px-6 text-center">
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
      {canEdit && (
        <Link
          href="/dashboard"
          className="btn btn-primary fixed bottom-5 left-1/2 z-50 -translate-x-1/2 shadow-2xl"
        >
          {d.portfolio.edit}
        </Link>
      )}
    </>
  );
}
