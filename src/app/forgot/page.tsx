import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { currentLocale } from "@/lib/locale";
import { dict } from "@/lib/i18n";
import { LogoLockup } from "@/components/brand/logo";
import { ForgotPasswordForm } from "@/components/password-reset-forms";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: dict(await currentLocale()).meta.forgot,
    robots: { index: false, follow: false },
  };
}

export const dynamic = "force-dynamic";

export default async function ForgotPasswordPage() {
  const user = await currentUser();
  if (user) redirect(user.role === "client" ? "/dashboard" : "/console");

  const copy = dict(await currentLocale()).reset;

  return (
    <main className="relative z-10 grid min-h-dvh place-items-center px-5 py-12">
      <div className="w-full max-w-[420px]">
        <div className="mb-7 flex justify-center">
          <LogoLockup size={42} />
        </div>
        <div className="card p-7 sm:p-8">
          <h1 className="text-2xl font-bold">{copy.forgotTitle}</h1>
          <p className="mb-6 mt-1.5 text-sm leading-relaxed text-mist-400">{copy.forgotSub}</p>
          <ForgotPasswordForm copy={copy} />
        </div>
      </div>
    </main>
  );
}
