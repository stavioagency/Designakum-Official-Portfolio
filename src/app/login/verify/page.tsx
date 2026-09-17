import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LogoLockup } from "@/components/brand/logo";
import { SecondFactorForm } from "@/components/account/second-factor-form";
import { pendingSecondFactor } from "@/lib/auth";
import { currentLocale } from "@/lib/locale";
import { dict } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: dict(await currentLocale()).twoFactor.title,
    robots: { index: false, follow: false },
  };
}

export const dynamic = "force-dynamic";

/**
 * The second step of signing in.
 *
 * Arriving here without having given a correct password first is not a state
 * worth rendering — there is nothing to verify — so it sends them back to start
 * rather than showing a form that cannot succeed.
 */
export default async function VerifyPage() {
  const pending = await pendingSecondFactor();
  if (!pending) redirect("/login");

  const d = dict(await currentLocale());

  return (
    <main className="relative z-10 flex min-h-dvh items-center justify-center px-5 py-12">
      <div className="w-full max-w-[400px]">
        <div className="mb-7 flex justify-center">
          <LogoLockup size={42} />
        </div>
        <div className="card p-7 sm:p-8">
          <h1 className="text-2xl font-bold">{d.twoFactor.title}</h1>
          <p className="mb-6 mt-1.5 text-sm leading-relaxed text-mist-400">{d.twoFactor.sub}</p>
          <SecondFactorForm copy={d.twoFactor} errors={d.authErrors} />
        </div>
      </div>
    </main>
  );
}
