import type { Metadata } from "next";
import Link from "next/link";
import { LogoLockup } from "@/components/brand/logo";
import { ConfirmEmailForm } from "@/components/account/confirm-email-form";
import { pendingEmailFor } from "@/lib/email-change";
import { currentLocale } from "@/lib/locale";
import { dict } from "@/lib/i18n";
import { AlertTriangle } from "@/components/icons";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: dict(await currentLocale()).emailChange.title,
    robots: { index: false, follow: false },
  };
}

export const dynamic = "force-dynamic";

export default async function ConfirmEmailPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const pendingEmail = await pendingEmailFor(token);
  const copy = dict(await currentLocale()).emailChange;

  return (
    <main className="relative z-10 flex min-h-dvh items-center justify-center px-5 py-12">
      <div className="w-full max-w-[420px]">
        <div className="mb-7 flex justify-center">
          <LogoLockup size={42} />
        </div>
        <div className="card p-7 sm:p-8">
          {pendingEmail ? (
            <>
              <h1 className="text-2xl font-bold">{copy.title}</h1>
              <p className="mb-6 mt-1.5 text-sm leading-relaxed text-mist-400">{copy.sub}</p>
              <ConfirmEmailForm token={token} newEmail={pendingEmail} copy={copy} />
            </>
          ) : (
            <div className="text-center">
              <span className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-amber-400/12 text-amber-300">
                <AlertTriangle className="h-6 w-6" />
              </span>
              <h1 className="text-xl font-bold">{copy.deadTitle}</h1>
              <p className="mt-3 text-sm leading-relaxed text-mist-400">{copy.deadBody}</p>
              <Link href="/login" className="btn btn-primary mt-6 w-full">
                {copy.backToLogin}
              </Link>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
