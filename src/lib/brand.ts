import { BRAND_MANIFEST } from "./brand-manifest";

export const BRAND = {
  name: "ديزاينكم",
  nameEn: "Designakum",
  tagline: "منصة معارض الأعمال",
  taglineEn: "The portfolio platform",
  blue: "#1b4d9b",
  blueBright: "#2563c9",
  ink: "#07080e",
} as const;

/**
 * The URL for a piece of brand artwork, or null if it has not been added.
 *
 * Answered from a manifest generated at build time rather than by probing the
 * filesystem. `public/` is a real directory on a machine with a disk and is not
 * one once the app is bundled for Workers, where it is served by the platform's
 * asset system — a filesystem probe there returns nothing, and every logo on
 * the site falls back to type without a single error to show for it.
 *
 * Staying synchronous is the point: this is called from components that are not
 * async, and from the landing page's pricing copy.
 */
export function brandAsset(base: string): string | null {
  return BRAND_MANIFEST[base] ?? null;
}

export type BrandAssetName =
  | "wordmark-light"
  | "wordmark-brand"
  | "wordmark-dark"
  | "mark-light"
  | "mark-brand"
  | "mark-dark"
  | "welcome-ar"
  | "og"
  | "riyal";

export const BRAND_ASSETS: {
  name: BrandAssetName;
  description: string;
  descriptionEn: string;
}[] = [
  {
    name: "wordmark-light",
    description: "الشعار الكامل بالأبيض — للخلفيات الداكنة والزرقاء",
    descriptionEn: "Full logo in white — for dark and blue backgrounds",
  },
  {
    name: "wordmark-brand",
    description: "الشعار الكامل باللون الأزرق — للخلفيات السوداء أو الفاتحة",
    descriptionEn: "Full logo in blue — for black or light backgrounds",
  },
  {
    name: "wordmark-dark",
    description: "الشعار الكامل بالأسود — للخلفيات الفاتحة",
    descriptionEn: "Full logo in black — for light backgrounds",
  },
  {
    name: "mark-light",
    description: "الأيقونة بالأبيض — للخلفيات الداكنة",
    descriptionEn: "Icon in white — for dark backgrounds",
  },
  { name: "mark-brand", description: "الأيقونة باللون الأزرق", descriptionEn: "Icon in blue" },
  {
    name: "mark-dark",
    description: "الأيقونة بالأسود — للخلفيات الفاتحة",
    descriptionEn: "Icon in black — for light backgrounds",
  },
  {
    name: "welcome-ar",
    description: "خط «أهلاً وسهلاً بكم» — شاشة الترحيب واختيار اللغة",
    descriptionEn: "The \u201cahlan wa sahlan\u201d calligraphy \u2014 welcome and language screens",
  },
  {
    name: "og",
    description: "بطاقة المشاركة الاجتماعية 1200×630 — تظهر عند مشاركة أي رابط",
    descriptionEn: "The 1200\u00d7630 social card \u2014 shown whenever a link is shared",
  },
  {
    name: "riyal",
    description: "رمز الريال السعودي الرسمي (أحادي اللون)",
    descriptionEn: "The official Saudi riyal symbol (monochrome)",
  },
];

export function missingBrandAssets(): BrandAssetName[] {
  return BRAND_ASSETS.filter((a) => !brandAsset(a.name)).map((a) => a.name);
}
