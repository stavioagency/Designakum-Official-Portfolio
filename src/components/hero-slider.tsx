"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Slide } from "@/lib/types";

export function HeroSlider({ slides, tall = false }: { slides: Slide[]; tall?: boolean }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  const scrollTo = useCallback((index: number) => {
    const track = trackRef.current;
    if (!track) return;
    // In an RTL track the first slide sits at scrollLeft 0 and later slides are negative.
    const sign = getComputedStyle(track).direction === "rtl" ? -1 : 1;
    track.scrollTo({ left: sign * index * track.clientWidth, behavior: "smooth" });
  }, []);

  const onScroll = useCallback(() => {
    const track = trackRef.current;
    if (!track || track.clientWidth === 0) return;
    const index = Math.round(Math.abs(track.scrollLeft) / track.clientWidth);
    setActive(Math.min(slides.length - 1, Math.max(0, index)));
  }, [slides.length]);

  useEffect(() => {
    if (slides.length < 2) return;
    const id = setInterval(() => {
      const track = trackRef.current;
      if (!track || document.hidden) return;
      const next = (Math.round(Math.abs(track.scrollLeft) / track.clientWidth) + 1) % slides.length;
      scrollTo(next);
    }, 6000);
    return () => clearInterval(id);
  }, [slides.length, scrollTo]);

  if (!slides.length) return null;

  return (
    <div className="relative">
      <div
        ref={trackRef}
        onScroll={onScroll}
        className="no-scrollbar snap-x-mandatory flex overflow-x-auto overscroll-x-contain rounded-[26px]"
        style={{ scrollbarWidth: "none" }}
      >
        {slides.map((slide) => (
          <figure
            key={slide.id}
            className={`snap-start relative w-full shrink-0 overflow-hidden ${
              tall ? "aspect-[16/10] @5xl:aspect-[16/8]" : "aspect-[5/3]"
            }`}
          >
            {slide.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={slide.image_url}
                alt={slide.headline || ""}
                className="absolute inset-0 h-full w-full object-cover"
              />
            ) : (
              <div className="accent-grad absolute inset-0" />
            )}

            {(slide.headline || slide.subline) && (
              <>
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                <figcaption className="absolute inset-x-0 bottom-0 p-5 text-center @5xl:p-8">
                  {slide.headline && (
                    /* Always white: this sits on the image's own dark scrim, not
                       on the page, so it must not follow a light background's
                       dark text down onto a black gradient. */
                    <p className="text-[26px] font-bold leading-tight text-white drop-shadow-lg @5xl:text-4xl">
                      {slide.headline}
                    </p>
                  )}
                  {slide.subline && (
                    <p className="mt-2 text-sm text-white/85 @5xl:text-base">{slide.subline}</p>
                  )}
                </figcaption>
              </>
            )}
          </figure>
        ))}
      </div>

      {slides.length > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2">
          {slides.map((slide, i) => (
            <button
              key={slide.id}
              onClick={() => scrollTo(i)}
              aria-label={`${i + 1}`}
              className="h-2 rounded-full transition-all duration-300"
              style={{
                width: i === active ? 26 : 8,
                background:
                  i === active ? "var(--accent-ring)" : "rgba(255,255,255,0.22)",
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
