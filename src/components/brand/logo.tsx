import Link from "next/link";
import { BRAND, brandAsset } from "@/lib/brand";

type Variant = "light" | "brand" | "dark";

/**
 * Renders the official Designakum artwork when it is present in `public/brand/`,
 * and a typographic stand-in until then — so the platform looks intentional either
 * way and picks up the real logo the moment the file is dropped in.
 */
export function Wordmark({
  variant = "light",
  height = 26,
  className = "",
}: {
  variant?: Variant;
  height?: number;
  className?: string;
}) {
  const src = brandAsset(`wordmark-${variant}`) ?? brandAsset("wordmark-light");

  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={BRAND.nameEn}
        style={{ height }}
        className={`w-auto object-contain ${className}`}
      />
    );
  }

  // Typographic stand-in: the Arabic and Latin names swap with the page language,
  // handled in CSS so this stays a plain server component.
  return (
    <span
      className={`font-bold leading-none tracking-tight ${
        variant === "light" ? "text-mist-50" : "accent-text"
      } ${className}`}
      style={{ fontSize: height * 0.86 }}
    >
      <span className="brand-name-ar">{BRAND.name}</span>
      <span className="brand-name-en">{BRAND.nameEn}</span>
    </span>
  );
}

/**
 * The logo, as a link home.
 *
 * The wordmark alone. The monogram is the favicon and the app icon and nothing
 * else — paired with the wordmark it read as two logos rather than one.
 */
export function LogoLockup({
  href = "/",
  size = 38,
  className = "",
}: {
  href?: string;
  /** Kept as the caller's sense of scale; the wordmark is sized from it. */
  size?: number;
  className?: string;
}) {
  return (
    <Link href={href} className={`flex items-center ${className}`} aria-label={BRAND.nameEn}>
      <Wordmark height={size * 0.72} />
    </Link>
  );
}
