import type { Locale } from "@/lib/types";

/**
 * The official Saudi Riyal symbol, rendered from the brand asset in
 * `public/brand/riyal.*` when it exists. The mark is a mask, not an `<img>`, so it
 * inherits `currentColor` and matches whatever text it sits beside. Until the
 * asset is supplied it falls back to the written abbreviation rather than drawing
 * an approximation of the glyph.
 */
export function Riyal({
  src,
  locale = "ar",
  size = "1em",
  className = "",
}: {
  src: string | null;
  locale?: Locale;
  size?: string | number;
  className?: string;
}) {
  const label = locale === "ar" ? "ريال سعودي" : "Saudi Riyal";

  if (!src) {
    return (
      <span className={`font-medium ${className}`} aria-label={label}>
        {locale === "ar" ? "ر.س" : "SAR"}
      </span>
    );
  }

  return (
    <span
      role="img"
      aria-label={label}
      className={`inline-block shrink-0 bg-current align-[-0.1em] ${className}`}
      style={{
        width: size,
        height: size,
        maskImage: `url(${src})`,
        WebkitMaskImage: `url(${src})`,
        maskRepeat: "no-repeat",
        WebkitMaskRepeat: "no-repeat",
        maskPosition: "center",
        WebkitMaskPosition: "center",
        maskSize: "contain",
        WebkitMaskSize: "contain",
      }}
    />
  );
}
