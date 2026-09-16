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
