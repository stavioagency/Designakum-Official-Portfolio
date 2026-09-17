import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { getPortfolioForUser } from "@/lib/portfolios";
import { needsOnboarding } from "@/lib/onboarding";
import { slugify } from "@/lib/ids";
import { currentLocale } from "@/lib/locale";
import { dict } from "@/lib/i18n";
import { requestOrigin } from "@/lib/origin";
import { claimLinkAction } from "@/app/actions/onboarding";
import { WelcomeForm } from "@/components/welcome-form";
import { LogoLockup } from "@/components/brand/logo";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: dict(await currentLocale()).welcome.title,
    robots: { index: false, follow: false },
  };
}
export const dynamic = "force-dynamic";

/**
 * The one step between signing up and the editor.
 *
 * It exists because Google sign-in cannot ask for a portfolio link on the consent
 * screen: the account was given a generated one and never told. Password sign-up
 * used to carry the field instead, which made the form longer than it needed to
 * be and asked for the decision before anyone had seen the product. Both routes
 * now land here, so there is one answer to "how do I pick my link?".
 */
export default async function WelcomePage({
  searchParams,
}: {
  searchParams: Promise<{ slug?: string }>;
}) {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (!needsOnboarding(user)) redirect(user.role === "client" ? "/dashboard" : "/console");

  const portfolio = await getPortfolioForUser(user.id);
  if (!portfolio) redirect("/login");

  const d = dict(await currentLocale()).welcome;
  // A name typed on the landing page arrives here as a suggestion. Whether it
  // is actually free is answered by the field itself, now that there is a
  // session to ask with.
  const { slug: wanted } = await searchParams;
  const origin = (await requestOrigin()).replace(/^https?:\/\//, "");

  return (
    <main className="relative z-10 grid min-h-dvh place-items-center px-5 py-12">
      <div className="w-full max-w-[440px]">
        <div className="mb-7 flex justify-center">
          <LogoLockup size={42} />
        </div>
        <div className="card p-7 sm:p-8">
          <h1 className="text-2xl font-bold">{d.title}</h1>
          <p className="mb-6 mt-1.5 text-sm text-mist-400">{d.sub}</p>
          <WelcomeForm
            action={claimLinkAction}
            d={d}
            origin={origin}
            suggestion={wanted ? slugify(wanted) : portfolio.slug}
          />
        </div>
      </div>
    </main>
  );
}
