import { setLocaleAction } from "@/app/actions/auth";
import { Mark } from "@/components/brand/logo";
import { PatternBand, WelcomeCalligraphy } from "@/components/brand/ornament";
import type { Locale } from "@/lib/types";

/**
 * The first thing a new visitor sees.
 *
 * Everything after this — the landing page, signup, the dashboard, the editor,
 * receipts, password-reset mail — is in the language chosen here, so it is worth
 * one screen up front rather than a switcher someone has to go looking for.
 *
 * Deliberately not a client component and not a modal: it renders before the
 * page, works with JavaScript off, and each choice is a plain form post that
 * sets the cookie and reloads. The choice is asked once and remembered for a
 * year; crawlers never see it at all.
 */
export function LanguageGate({
  pathname,
  suggested,
}: {
  pathname: string;
  suggested: Locale;
}) {
  return (
    <main className="grid min-h-dvh place-items-center px-5 py-10">
      <div className="card w-full max-w-lg overflow-hidden p-7 text-center sm:p-9">
        {/* The calligraphy says "welcome" better than either sentence did, and it
            says it before the visitor has told us which language to use. */}
        <div className="flex justify-center">
          <Mark size={44} />
        </div>

        <WelcomeCalligraphy className="mt-7" />

        <PatternBand className="mt-7" />

        <p className="mt-7 text-[12.5px] text-mist-400">
          <span dir="rtl" lang="ar">اختر لغتك</span>
          <span className="mx-2 text-mist-600">·</span>
          <span dir="ltr" lang="en">Choose your language</span>
        </p>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <LanguageChoice
            locale="ar"
            label="العربية"
            hint="الواجهة من اليمين إلى اليسار"
            pathname={pathname}
            recommended={suggested === "ar"}
          />
          <LanguageChoice
            locale="en"
            label="English"
            hint="Left-to-right interface"
            pathname={pathname}
            recommended={suggested === "en"}
          />
        </div>

      </div>
    </main>
  );
}

function LanguageChoice({
  locale,
  label,
  hint,
  pathname,
  recommended,
}: {
  locale: Locale;
  label: string;
  hint: string;
  pathname: string;
  recommended: boolean;
}) {
  return (
    <form action={setLocaleAction}>
      <input type="hidden" name="path" value={pathname} />
      <input type="hidden" name="locale" value={locale} />
      <button
        type="submit"
        lang={locale}
        dir={locale === "ar" ? "rtl" : "ltr"}
        className={`w-full rounded-2xl border px-4 py-5 text-center transition ${
          recommended
            ? "border-white/20 bg-white/[0.07] hover:bg-white/[0.11]"
            : "border-white/8 bg-white/[0.03] hover:bg-white/[0.07]"
        }`}
      >
        <span className="block text-[17px] font-semibold">{label}</span>
        <span className="mt-1 block text-[11.5px] text-mist-500">{hint}</span>
      </button>
    </form>
  );
}
