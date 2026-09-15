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

export function Mark({
  variant = "light",
  size = 38,
  className = "",
}: {
  variant?: Variant;
  size?: number;
  className?: string;
}) {
  const src = brandAsset(`mark-${variant}`) ?? brandAsset("mark-light");

  if (src) {
    return (
      <span
        className={`grid shrink-0 place-items-center overflow-hidden rounded-2xl ${className}`}
        style={{
          width: size,
          height: size,
          background: variant === "light" ? BRAND.blue : "transparent",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="" className="h-[74%] w-[74%] object-contain" />
      </span>
    );
  }

  return (
    <span
      className={`accent-grad grid shrink-0 place-items-center rounded-2xl font-bold text-white ${className}`}
      style={{ width: size, height: size, fontSize: size * 0.42 }}
    >
      D
    </span>
  );
}

/** Mark + wordmark lockup, used in navigation bars. */
export function LogoLockup({
  href = "/",
  size = 38,
  className = "",
}: {
  href?: string;
  size?: number;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-2.5 ${className}`}
      aria-label={BRAND.nameEn}
    >
      <Mark size={size} />
      <Wordmark height={size * 0.6} className="hidden sm:block" />
    </Link>
  );
}
