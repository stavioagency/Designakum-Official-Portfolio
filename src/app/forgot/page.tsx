import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { LogoLockup } from "@/components/brand/logo";
import { ForgotPasswordForm } from "@/components/password-reset-forms";

export const metadata: Metadata = { title: "استعادة كلمة المرور" };
export const dynamic = "force-dynamic";

export default async function ForgotPasswordPage() {
  const user = await currentUser();
  if (user) redirect(user.role === "client" ? "/dashboard" : "/console");

  return (
    <main className="relative z-10 grid min-h-dvh place-items-center px-5 py-12">
      <div className="w-full max-w-[420px]">
        <div className="mb-7 flex justify-center">
          <LogoLockup size={42} />
        </div>
        <div className="card p-7 sm:p-8">
          <h1 className="text-2xl font-bold">نسيت كلمة المرور؟</h1>
          <p className="mb-6 mt-1.5 text-sm leading-relaxed text-mist-400">
            أدخل بريدك الإلكتروني وسنرسل لك رابطًا صالحًا لمدة ساعة لتعيين كلمة مرور جديدة.
          </p>
          <ForgotPasswordForm />
        </div>
      </div>
    </main>
  );
}
