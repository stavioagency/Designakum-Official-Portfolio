import type { Metadata, Viewport } from "next";
import { BRAND, brandAsset } from "@/lib/brand";
import { DIR } from "@/lib/i18n";
import { headers } from "next/headers";
import { currentLocale, gateApplies, hasChosenLocale, suggestedLocale } from "@/lib/locale";
import { dict } from "@/lib/i18n";
import { callerIsBot } from "@/lib/bots";
import { requestOrigin } from "@/lib/origin";
import { CookieNotice } from "@/components/cookie-notice";
import { LanguageGate } from "@/components/language-gate";
import "./globals.css";

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

  return (
    <html lang={locale} dir={DIR[locale]}>
      <head>
        {icon && <link rel="icon" href={icon} />}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@300;400;500;600;700&family=Tajawal:wght@400;500;700;800&family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="ambient">
        {gate ? (
          // The gate replaces the page rather than floating over it. An overlay
          // leaves the page scrolling underneath and leaks the other language
          // past the edges of the card, which is the thing it exists to prevent.
          <LanguageGate pathname={pathname} suggested={gate} />
        ) : (
          <>
            {children}
            <CookieNotice
              body={d.cookies.body}
              policy={d.cookies.policy}
              dismiss={d.cookies.dismiss}
            />
          </>
        )}
      </body>
    </html>
  );
}
