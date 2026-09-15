import type { Metadata } from "next";
import { currentLocale } from "@/lib/locale";
import { dict, fill } from "@/lib/i18n";
import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { canPublish } from "@/lib/billing";
import { getPortfolioForUser, loadBundle } from "@/lib/portfolios";
import { requestOrigin } from "@/lib/origin";
import { Editor } from "@/components/editor/editor";
import { PortfolioView } from "@/components/portfolio-view";
import { Eye } from "@/components/icons";
import { liveAnnouncementsFor } from "@/lib/announcements";
import { AnnouncementBanner } from "@/components/announcement-banner";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: dict(await currentLocale()).meta.dashboard,
  };
}
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await currentUser();
  if (!user) redirect("/login");

  const portfolio = await getPortfolioForUser(user.id);
  if (!portfolio) redirect("/console");

  const bundle = await loadBundle(portfolio);
  const origin = await requestOrigin();
  const published = portfolio.published === 1;

  const announcements = await liveAnnouncementsFor(user.id);
  const locale = await currentLocale();
  const d = dict(locale);
  const copy = d.dashboard;

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-7 sm:px-6 lg:py-10">
      <AnnouncementBanner
        announcements={announcements}
        locale={locale}
        dismissLabel={d.announcements.dismiss}
      />
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-[26px] font-bold">{fill(copy.home.greeting, { name: portfolio.name.split(" ")[0] })}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-[13.5px] text-mist-400">
            <span
              className={`rounded-full px-2.5 py-1 text-[11.5px] font-semibold ${
                published ? "bg-emerald-400/12 text-emerald-300" : "bg-amber-400/12 text-amber-300"
              }`}
            >
              {published ? copy.home.published : copy.home.draft}
            </span>
            <span className="tnum flex items-center gap-1.5">
              <Eye className="h-4 w-4" />
              {fill(copy.home.views, { n: portfolio.views })}
            </span>
            <code dir="ltr" className="text-mist-500">/p/{portfolio.slug}</code>
          </p>
        </div>

        <Link href="/dashboard/preview" className="btn btn-ghost">
          {copy.home.previewCta}
        </Link>
      </div>

      <Editor
        bundle={bundle}
        user={user}
        origin={origin}
        preview={<PortfolioView bundle={bundle} />}
        hasPassword={user.password_hash !== ""}
        canPublish={await canPublish(user)}
        copy={copy}
      />
    </main>
  );
}
