import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans_Arabic, Inter, Readex_Pro } from "next/font/google";
import { BRAND, brandAsset } from "@/lib/brand";
import { DIR } from "@/lib/i18n";
import { headers } from "next/headers";
import { currentLocale, gateApplies, hasChosenLocale, pageLocale, suggestedLocale } from "@/lib/locale";
import { dict } from "@/lib/i18n";
import { callerIsBot } from "@/lib/bots";
import { requestOrigin } from "@/lib/origin";
import { CookieNotice } from "@/components/cookie-notice";
import { LanguageGate } from "@/components/language-gate";
import "./globals.css";

/**
 * Self-hosted rather than fetched from Google at render time.
 *
 * The old <link> cost two preconnects and a render-blocking stylesheet on a
 * third-party origin before a single glyph arrived, and it pulled three families
 * at thirteen weights when the site uses four. Tajawal was never anything but a
 * fallback name in the stack, and nothing anywhere asks for a 300 or an 800.
 */
const arabic = IBM_Plex_Sans_Arabic({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-arabic",
  display: "swap",
});

/**
 * One display face, for headlines only.
 *
 * The page set Arabic and English headlines in the same text face at the same
 * weight, which is why the Arabic read as translated rather than designed.
 * Readex Pro draws both scripts in one family, so a headline in either language
 * has the same voice instead of two fallbacks pretending to match. Two weights,
 * and nothing but headings uses it — a display face in body copy is a headache.
 */
const display = Readex_Pro({
  subsets: ["arabic", "latin"],
  weight: ["500", "700"],
  variable: "--font-display",
  display: "swap",
});

const latin = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-latin",
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const locale = await currentLocale();
  const d = dict(locale);
  const origin = await requestOrigin();
  const title = `${BRAND.nameEn} — ${d.brandTagline}`;
  // Absolute, because a social crawler resolves this without a page to sit on.
  const card = brandAsset("og");

  return {
    metadataBase: new URL(origin),
    title: { default: title, template: `%s · ${BRAND.nameEn}` },
    description: d.meta.description,
    applicationName: BRAND.nameEn,
    openGraph: {
      title,
      description: d.meta.description,
      siteName: BRAND.nameEn,
      locale: locale === "ar" ? "ar_SA" : "en_US",
      type: "website",
      images: card ? [{ url: card, width: 1200, height: 630, alt: BRAND.nameEn }] : undefined,
    },
    twitter: {
      card: card ? "summary_large_image" : "summary",
      title,
      description: d.meta.description,
      images: card ? [card] : undefined,
    },
  };
}

export const viewport: Viewport = {
  themeColor: BRAND.ink,
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await currentLocale();
  const icon = brandAsset("favicon") ?? brandAsset("icon") ?? brandAsset("mark-brand") ?? brandAsset("mark-light");

  const d = dict(locale);

  // Asked once, on the marketing and account journey only, and never of a crawler
  // — a search engine that saw the gate instead of the page would index the gate.
  const pathname = (await headers()).get("x-pathname") ?? "/";
  const gate =
    gateApplies(pathname) && !(await hasChosenLocale()) && !(await callerIsBot())
      ? await suggestedLocale()
      : null;

  /**
   * A portfolio is written in its owner's language, and the document has to say
   * which — an English page announced as Arabic is wrong to a screen reader and
   * to a crawler, and the right-to-left document direction leaked out past the
   * page into the notice and the scrollbar. Everywhere else is the platform
   * speaking to the reader, which follows the reader.
   */
  const written = (await pageLocale(pathname)) ?? locale;
  const page = written === locale ? d : dict(written);

  return (
    <html lang={written} dir={DIR[written]} className={`${arabic.variable} ${latin.variable} ${display.variable}`}>
      <head>{icon && <link rel="icon" href={icon} />}</head>
      <body className="ambient">
        {gate ? (
          // The gate replaces the page rather than floating over it. An overlay
          // leaves the page scrolling underneath and leaks the other language
          // past the edges of the card, which is the thing it exists to prevent.
          <LanguageGate pathname={pathname} suggested={gate} />
        ) : (
          <>
            {children}
            {/* In the page's language too. A notice in the other one, on a
                page that is entirely in this one, reads as a broken page
                rather than as a considerate translation. */}
            <CookieNotice
              body={page.cookies.body}
              policy={page.cookies.policy}
              dismiss={page.cookies.dismiss}
            />
          </>
        )}
      </body>
    </html>
  );
}
