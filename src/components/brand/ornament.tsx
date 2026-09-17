import { brandAsset } from "@/lib/brand";

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

/**
 * The monogram, very large and very faint, as the texture of a section.
 *
 * `public/brand/README.md` says the mark is never set beside the wordmark — two
 * logos in one lockup read as two brands. This is not that: it is artwork at a
 * size nobody reads as a logo, behind the content, carrying the brand's shape
 * rather than announcing it. Never in the way: no pointer events, hidden from
 * assistive technology, and faint enough that the text in front of it keeps its
 * full contrast.
 */
export function BrandWatermark({
  className = "",
  opacity = 0.1,
}: {
  className?: string;
  opacity?: number;
}) {
  /**
   * The blue mark, not the white one. White at a low opacity is grey, and grey
   * on this near-black ground reads as a smudge somebody forgot to delete;
   * brand blue at the same weight reads as light in the room, and matches the
   * accent wash the page already sits in.
   */
  const src = brandAsset("mark-brand") ?? brandAsset("mark-light");
  if (!src) return null;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      aria-hidden
      draggable={false}
      style={{ opacity }}
      className={`pointer-events-none absolute select-none object-contain ${className}`}
    />
  );
}
