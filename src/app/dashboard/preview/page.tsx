import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { getPortfolioForUser, loadBundle } from "@/lib/portfolios";
import { PortfolioView } from "@/components/portfolio-view";
import { PreviewFrame } from "@/components/preview-frame";
import { PublishBar } from "@/components/editor/publish-bar";
import { canPublish } from "@/lib/billing";

export const metadata: Metadata = { title: "معاينة" };
export const dynamic = "force-dynamic";

export default async function PreviewPage() {
  const user = await currentUser();
  if (!user) redirect("/login");

  const portfolio = await getPortfolioForUser(user.id);
  if (!portfolio) redirect("/console");

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-7 sm:px-6 lg:py-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-[26px] font-bold">معاينة الصفحة</h1>
          <p className="mt-1 text-[13.5px] text-mist-400">
            هكذا سيرى زوارك صفحتك تمامًا — جرّبها على الجوال وسطح المكتب.
          </p>
        </div>
        <Link href="/dashboard" className="btn btn-ghost">
          العودة للمحرر
        </Link>
      </div>

      <PublishBar portfolio={portfolio} canPublish={await canPublish(user)} />

      <div className="mt-6">
        <PreviewFrame>
          <PortfolioView bundle={await loadBundle(portfolio)} />
        </PreviewFrame>
      </div>
    </main>
  );
}
