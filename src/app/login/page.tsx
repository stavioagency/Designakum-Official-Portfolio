import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { LogoLockup } from "@/components/brand/logo";
import { loginAction } from "@/app/actions/auth";
import { currentUser } from "@/lib/auth";
import { googleConfigured } from "@/lib/google";
import { currentLocale } from "@/lib/locale";
import { dict } from "@/lib/i18n";
import { readSettings } from "@/lib/settings";

export const metadata: Metadata = {
  title: "تسجيل الدخول",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await currentUser();
  if (user) redirect(user.role === "client" ? "/dashboard" : "/console");

  const { error } = await searchParams;
  const d = dict(await currentLocale());
  const settings = await readSettings();

  return (
    <main className="relative z-10 grid min-h-dvh place-items-center px-5 py-12">
      <div className="w-full max-w-[420px]">
        <div className="mb-7 flex justify-center">
          <LogoLockup size={42} />
        </div>
        <div className="card p-7 sm:p-8">
          <h1 className="text-2xl font-bold">{d.auth.loginTitle}</h1>
          <p className="mb-6 mt-1.5 text-sm text-mist-400">{d.auth.loginSub}</p>
          <AuthForm
            mode="login"
            action={loginAction}
            d={d.auth}
            errors={d.authErrors}
            googleReady={googleConfigured() && settings["features.google_signin"]}
            initialError={error}
          />
        </div>
      </div>
    </main>
  );
}
