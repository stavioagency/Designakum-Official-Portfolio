import type { Metadata, Viewport } from "next";
import { BRAND, brandAsset } from "@/lib/brand";
import { DIR } from "@/lib/i18n";
import { currentLocale } from "@/lib/locale";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: `${BRAND.nameEn} — ${BRAND.tagline}`,
    template: `%s · ${BRAND.nameEn}`,
  },
  description:
    "ديزاينكم: منصة عربية لإنشاء صفحات أعمال احترافية للمصممين والمستقلين، بروابط خاصة ولوحة تحكم كاملة.",
  applicationName: BRAND.nameEn,
};

export const viewport: Viewport = {
  themeColor: BRAND.ink,
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await currentLocale();
  const icon = brandAsset("favicon") ?? brandAsset("icon") ?? brandAsset("mark-brand") ?? brandAsset("mark-light");

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
      <body className="ambient">{children}</body>
    </html>
  );
}
