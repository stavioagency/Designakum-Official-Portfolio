import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { LogoLockup } from "@/components/brand/logo";
import { signupAction } from "@/app/actions/auth";
import { currentUser } from "@/lib/auth";
import { googleConfigured } from "@/lib/google";
import { currentLocale } from "@/lib/locale";
import { dict } from "@/lib/i18n";
import { readSettings } from "@/lib/settings";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: dict(await currentLocale()).meta.signup,
  };
}
export const dynamic = "force-dynamic";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; invite?: string }>;
}) {
  const user = await currentUser();
  if (user) redirect(user.role === "client" ? "/dashboard" : "/console");

  const { error, invite } = await searchParams;
  const d = dict(await currentLocale());
  const settings = await readSettings();
  const inviteRequired = settings["platform.invite_only"] || !settings["platform.signups_open"];

  return (
    <main className="relative z-10 grid min-h-dvh place-items-center px-5 py-12">
      <div className="w-full max-w-[440px]">
        <div className="mb-7 flex justify-center">
          <LogoLockup size={42} />
        </div>
        <div className="card p-7 sm:p-8">
          <h1 className="text-2xl font-bold">{d.auth.signupTitle}</h1>
          <p className="mb-6 mt-1.5 text-sm text-mist-400">
            {inviteRequired ? d.authErrors.invite_required : d.auth.signupSub}
          </p>
          <AuthForm
            mode="signup"
            action={signupAction}
            d={d.auth}
            errors={d.authErrors}
            passwordCopy={d.password}
            googleReady={googleConfigured() && settings["features.google_signin"]}
            initialError={error}
            inviteCode={invite}
            inviteRequired={inviteRequired}
          />
        </div>
      </div>
    </main>
  );
}
