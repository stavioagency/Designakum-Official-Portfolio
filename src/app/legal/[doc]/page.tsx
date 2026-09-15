import type { Metadata } from "next";
import { formatDate } from "@/components/console/ui";
import Link from "next/link";
import { notFound } from "next/navigation";
import { localized, readSettings, type SettingKey } from "@/lib/settings";
import { currentLocale } from "@/lib/locale";
import { dict, fill } from "@/lib/i18n";
import { LogoLockup } from "@/components/brand/logo";
import { LocaleSwitch } from "@/components/locale-switch";
import { AlertTriangle } from "@/components/icons";

export const dynamic = "force-dynamic";

const DOCUMENTS = {
  terms: { key: "policy.terms" as SettingKey, title: "شروط الاستخدام", titleEn: "Terms of Service" },
  privacy: { key: "policy.privacy" as SettingKey, title: "سياسة الخصوصية", titleEn: "Privacy Policy" },
  rules: { key: "rules.portfolio" as SettingKey, title: "قواعد النشر", titleEn: "Publishing Rules" },
} as const;

type Doc = keyof typeof DOCUMENTS;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ doc: string }>;
}): Promise<Metadata> {
  const { doc } = await params;
  const entry = DOCUMENTS[doc as Doc];
  if (!entry) return {};
  const locale = await currentLocale();
  return { title: locale === "ar" ? entry.title : entry.titleEn };
}

export default async function LegalPage({ params }: { params: Promise<{ doc: string }> }) {
  const { doc } = await params;
  const entry = DOCUMENTS[doc as Doc];
  if (!entry) notFound();

  const locale = await currentLocale();
  const d = dict(locale);
  const settings = await readSettings();
  const body = localized(settings, entry.key, locale).trim();

  return (
    <div className="relative z-10">
      <header className="mx-auto flex h-20 w-full max-w-3xl items-center justify-between gap-4 px-5">
        <LogoLockup size={38} />
        <LocaleSwitch locale={locale} />
      </header>

      <main className="mx-auto w-full max-w-3xl px-5 pb-20">
        <h1 className="text-[30px] font-bold">{locale === "ar" ? entry.title : entry.titleEn}</h1>

        {body ? (
          <article className="card mt-6 whitespace-pre-wrap p-6 text-[14.5px] leading-[2] text-mist-200 sm:p-8">
            {body}
          </article>
        ) : (
          <div className="card mt-6 flex items-start gap-3 p-6">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" />
            <div>
              <p className="text-[15px] font-semibold text-amber-200">{d.legal.unpublished}</p>
              <p className="mt-2 text-[13.5px] leading-relaxed text-mist-400">
                {fill(d.legal.unpublishedBody, {
                  doc: locale === "ar" ? entry.title : entry.titleEn,
                })}
              </p>
            </div>
          </div>
        )}

        <p className="mt-6 text-[12px] text-mist-600">
          {fill(d.legal.updated, { date: formatDate(Date.now(), locale) })}
        </p>

        <Link href="/" className="btn btn-ghost mt-8">
          {d.portfolio.home}
        </Link>
      </main>
    </div>
  );
}
