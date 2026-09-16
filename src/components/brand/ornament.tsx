import { brandAsset } from "@/lib/brand";

/**
 * The Kufic band, used as a rule between sections.
 *
 * Purely decorative, so it carries no alt text and is hidden from assistive
 * technology; if the artwork has not been dropped in yet it renders nothing at
 * all rather than a gap.
 */
export function PatternBand({
  className = "",
  opacity = 0.16,
  height = 26,
}: {
  className?: string;
  opacity?: number;
  height?: number;
}) {
  const src = brandAsset("pattern-light");
  if (!src) return null;

  return (
    <div
      aria-hidden
      className={`pointer-events-none w-full bg-repeat-x bg-center ${className}`}
      style={{
        height,
        opacity,
        backgroundImage: `url(${src})`,
        backgroundSize: "auto 100%",
      }}
    />
  );
}

/**
 * "أهلاً وسهلاً بكم" — the welcome calligraphy.
 *
 * It greets in Arabic whichever language the reader ends up choosing, which is
 * the point: it is the brand's voice, not a translated string, so it is marked
 * as Arabic and given the phrase as its label rather than being hidden.
 */
export function WelcomeCalligraphy({ className = "" }: { className?: string }) {
  const src = brandAsset("welcome-ar");
  if (!src) return null;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt="أهلاً وسهلاً بكم"
      lang="ar"
      dir="rtl"
      className={`mx-auto h-auto w-full max-w-[340px] object-contain ${className}`}
    />
  );
}
