import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { getPortfolioForUser, loadBundle } from "@/lib/portfolios";
import { requestOrigin } from "@/lib/origin";
import { Editor } from "@/components/editor/editor";
import { PortfolioView } from "@/components/portfolio-view";
import { Eye } from "@/components/icons";
import { liveAnnouncementsFor } from "@/lib/announcements";
import { AnnouncementBanner } from "@/components/announcement-banner";

export const metadata: Metadata = { title: "لوحة التحكم" };
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await currentUser();
  if (!user) redirect("/login");

  const portfolio = getPortfolioForUser(user.id);
  if (!portfolio) redirect("/console");

  const bundle = loadBundle(portfolio);
  const origin = await requestOrigin();
  const published = portfolio.published === 1;

  const announcements = liveAnnouncementsFor(user.id);

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-7 sm:px-6 lg:py-10">
      <AnnouncementBanner announcements={announcements} />
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-[26px] font-bold">مرحبًا، {portfolio.name.split(" ")[0]}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-[13.5px] text-mist-400">
            <span
              className={`rounded-full px-2.5 py-1 text-[11.5px] font-semibold ${
                published ? "bg-emerald-400/12 text-emerald-300" : "bg-amber-400/12 text-amber-300"
              }`}
            >
              {published ? "منشور" : "مسودة"}
            </span>
            <span className="tnum flex items-center gap-1.5">
              <Eye className="h-4 w-4" />
              {portfolio.views} مشاهدة
            </span>
            <code dir="ltr" className="text-mist-500">/p/{portfolio.slug}</code>
          </p>
        </div>

        <Link href="/dashboard/preview" className="btn btn-ghost">
          معاينة قبل النشر
        </Link>
      </div>

      <Editor
        bundle={bundle}
        user={user}
        origin={origin}
        preview={<PortfolioView bundle={bundle} />}
        hasPassword={user.password_hash !== ""}
      />
    </main>
  );
}
