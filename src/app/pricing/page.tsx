import type { Metadata } from "next";
import Link from "next/link";
import { currentUser } from "@/lib/auth";
import { currentLocale } from "@/lib/locale";
import { dict } from "@/lib/i18n";
import { pricingCopy } from "@/lib/pricing-copy";
import { entitlementsFor } from "@/lib/billing";
import { LogoLockup } from "@/components/brand/logo";
import { LocaleSwitch } from "@/components/locale-switch";
import { Pricing } from "@/components/pricing";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: dict(await currentLocale()).meta.pricing,
  };
}
export const dynamic = "force-dynamic";

export default async function PricingPage() {
  const [user, locale] = await Promise.all([await currentUser(), await currentLocale()]);
  const d = dict(locale);

  return (
    <div className="relative z-10">
      <header className="mx-auto flex h-20 w-full max-w-6xl items-center justify-between gap-4 px-5">
        <LogoLockup size={40} />
        <nav className="flex items-center gap-2">
          <LocaleSwitch locale={locale} />
          {user ? (
            <Link href={user.role === "client" ? "/dashboard" : "/console"} className="btn btn-primary !py-2.5">
              {d.nav.dashboard}
            </Link>
          ) : (
            <Link href="/login" className="btn btn-ghost !py-2.5">{d.nav.login}</Link>
          )}
        </nav>
      </header>

      <main className="mx-auto w-full max-w-6xl px-5 py-12">
        <Pricing
          copy={await pricingCopy(locale)}
          currentPlan={user ? (await entitlementsFor(user)).plan : undefined}
          ctaHref={user ? "/dashboard/billing" : "/signup"}
        />
      </main>
    </div>
  );
}
