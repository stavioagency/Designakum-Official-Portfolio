import type { Metadata } from "next";
import Link from "next/link";
import { LogoLockup } from "@/components/brand/logo";
import { ResetPasswordForm } from "@/components/password-reset-forms";
import { findValidReset } from "@/lib/password-reset";
import { AlertTriangle } from "@/components/icons";

export const metadata: Metadata = { title: "تعيين كلمة مرور جديدة" };
export const dynamic = "force-dynamic";

export default async function ResetPasswordPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const valid = await findValidReset(token) !== null;

  return (
    <main className="relative z-10 grid min-h-dvh place-items-center px-5 py-12">
      <div className="w-full max-w-[420px]">
        <div className="mb-7 flex justify-center">
          <LogoLockup size={42} />
        </div>
        <div className="card p-7 sm:p-8">
          {valid ? (
            <>
              <h1 className="text-2xl font-bold">كلمة مرور جديدة</h1>
              <p className="mb-6 mt-1.5 text-sm leading-relaxed text-mist-400">
                اختر كلمة مرور جديدة. سيتم إنهاء أي جلسات مفتوحة على أجهزة أخرى.
              </p>
              <ResetPasswordForm token={token} />
            </>
          ) : (
            <div className="text-center">
              <span className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-amber-400/12 text-amber-300">
                <AlertTriangle className="h-6 w-6" />
              </span>
              <h1 className="text-xl font-bold">هذا الرابط لم يعد صالحًا</h1>
              <p className="mt-3 text-sm leading-relaxed text-mist-400">
                روابط الاستعادة تنتهي بعد ساعة، وتُستخدم مرة واحدة فقط.
              </p>
              <Link href="/forgot" className="btn btn-primary mt-6 w-full">
                اطلب رابطًا جديدًا
              </Link>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
