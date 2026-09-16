import "server-only";
import fs from "node:fs";
import path from "node:path";

export const BRAND = {
  name: "ديزاينكم",
  nameEn: "Designakum",
  tagline: "منصة معارض الأعمال",
  taglineEn: "The portfolio platform",
  blue: "#1b4d9b",
  blueBright: "#2563c9",
  ink: "#07080e",
} as const;

const BRAND_DIR = path.join(process.cwd(), "public", "brand");
const EXTENSIONS = [".svg", ".png", ".webp", ".jpg", ".jpeg", ".avif"];

/**
 * Brand artwork is dropped into `public/brand/` by the platform owner; the base
 * name is fixed, the extension is whatever they exported. Anything still missing
 * falls back to type, so the UI is never broken by an absent file.
 */
export function brandAsset(base: string): string | null {
  for (const ext of EXTENSIONS) {
    if (fs.existsSync(path.join(BRAND_DIR, base + ext))) return `/brand/${base}${ext}`;
  }
  return null;
}

export type BrandAssetName =
  | "wordmark-light"
  | "wordmark-brand"
  | "wordmark-dark"
  | "mark-light"
  | "mark-brand"
  | "mark-dark"
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
    name: "riyal",
    description: "رمز الريال السعودي الرسمي (أحادي اللون)",
    descriptionEn: "The official Saudi riyal symbol (monochrome)",
  },
];

export function missingBrandAssets(): BrandAssetName[] {
  return BRAND_ASSETS.filter((a) => !brandAsset(a.name)).map((a) => a.name);
}
