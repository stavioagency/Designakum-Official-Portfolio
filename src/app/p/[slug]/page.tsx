import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { get } from "@/lib/db";
import { entitlementsFor } from "@/lib/billing";
import { getPortfolioBySlug, loadBundle, recordView } from "@/lib/portfolios";
import { liftExpiredSuspension } from "@/lib/moderation";
import { isStaff } from "@/lib/permissions";
import { callerFingerprint } from "@/lib/rate-limit";
import { readSettings } from "@/lib/settings";
import { maintenanceState } from "@/lib/maintenance";
import { MaintenanceNotice } from "@/components/maintenance-notice";
import { currentLocale } from "@/lib/locale";
import { dict } from "@/lib/i18n";
import { PortfolioView } from "@/components/portfolio-view";
import { Ban } from "@/components/icons";
import type { User } from "@/lib/types";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const portfolio = getPortfolioBySlug(slug);
  if (!portfolio) return { title: "404" };

  const description = portfolio.bio.slice(0, 160) || portfolio.tagline;
  return {
    title: `${portfolio.name} — ${portfolio.title}`,
    description,
    openGraph: {
      title: `${portfolio.name} — ${portfolio.title}`,
      description,
      type: "profile",
      images: portfolio.avatar_url ? [portfolio.avatar_url] : undefined,
    },
  };
}

export default async function PublicPortfolioPage({ params }: Props) {
  const { slug } = await params;
  let portfolio = getPortfolioBySlug(slug);
  if (!portfolio) notFound();

  // A temporary suspension expires on its own the first time the page is opened.
  if (liftExpiredSuspension(portfolio)) portfolio = getPortfolioBySlug(slug)!;

  const maintenance = await maintenanceState({ portfolio: true });
  if (maintenance.blocked) {
    return <MaintenanceNotice message={maintenance.message} staff={maintenance.staff} />;
  }

  const viewer = await currentUser();
  const canEdit = !!viewer && (isStaff(viewer) || viewer.id === portfolio.user_id);
  const d = dict(await currentLocale());
  const settings = readSettings();

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

  if (!portfolio.published && !canEdit) {
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

  if (!canEdit) recordView(portfolio.id, await callerFingerprint());

  // The badge follows the page owner's subscription, not the viewer's.
  const owner = get<User>("SELECT * FROM users WHERE id = ?", portfolio.user_id);
  const showBadge = owner ? entitlementsFor(owner).showBadge : true;

  return (
    <>
      <PortfolioView
        bundle={loadBundle(portfolio)}
        showBadge={showBadge}
        live
        reportsOpen={settings["features.reports"]}
        rules={settings["rules.portfolio"]}
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
