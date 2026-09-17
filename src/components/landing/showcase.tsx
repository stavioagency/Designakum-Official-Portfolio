"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "@/components/icons";
import { PreviewFrame } from "@/components/preview-frame";

/**
 * More than one page, because one page reads as one template.
 *
 * A visitor shown a single example cannot tell whether the product could look
 * like *them*; two or three, in different themes and both languages, answer
 * that without a word of copy. Each is rendered on the server and all of them
 * are in the markup — this swaps which one is visible, so the first frame of
 * the page is never empty and a reader with no JavaScript still sees one.
 *
 * It stops on hover and on focus, and never starts at all when the visitor has
 * asked for less motion: something that moves on its own beside a form is a
 * distraction the moment somebody starts typing.
 */
const EVERY = 5000;

export function Showcase({
  pages,
  height,
  note,
  pickLabel,
  prevLabel,
  nextLabel,
}: {
  pages: { slug: string; label: string; theme: string; node: React.ReactNode }[];
  height: string;
  note: string;
  /** Carries {n} for the dot's accessible name. */
  pickLabel: string;
  prevLabel: string;
  nextLabel: string;
}) {
  const [shown, setShown] = useState(0);
  const [held, setHeld] = useState(false);
  /**
   * Set the moment somebody works the arrows or the dots, and never unset.
   *
   * Pausing on hover is not enough once a person is choosing for themselves: a
   * carousel that resumes on its own takes the page away from them again a few
   * seconds later, usually mid-read. The first deliberate press ends the
   * rotation for the rest of the visit.
   */
  const [taken, setTaken] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (pages.length < 2 || held || taken) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    timer.current = setInterval(() => setShown((was) => (was + 1) % pages.length), EVERY);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [pages.length, held, taken]);

  const step = (by: number) => {
    setTaken(true);
    setShown((was) => (was + by + pages.length) % pages.length);
  };

  const current = pages[shown] ?? pages[0];
  if (!current) return null;

  return (
    <div
      onMouseEnter={() => setHeld(true)}
      onMouseLeave={() => setHeld(false)}
      onFocusCapture={() => setHeld(true)}
      onBlurCapture={() => setHeld(false)}
    >
      <div className="relative min-w-0" style={{ height }}>
        {pages.map((page, i) => (
          <div
            key={page.slug}
            data-theme={page.theme}
            aria-hidden={i !== shown}
            /* Not just invisible: a hidden page is full of links, and without
               this the tab key walks through three portfolios nobody can see. */
            inert={i !== shown}
            /* Held in the layout rather than unmounted: swapping in a fresh
               portfolio every five seconds would re-run its images and animations
               from nothing each time. */
            className={`absolute inset-0 transition-opacity duration-700 ${
              i === shown ? "opacity-100" : "pointer-events-none opacity-0"
            }`}
          >
            <PreviewFrame height={height}>{page.node}</PreviewFrame>
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-col items-center gap-2.5">
        <Link
          href={`/p/${current.slug}`}
          className="text-[12.5px] text-mist-400 underline-offset-4 transition hover:text-white hover:underline"
        >
          {current.label}
        </Link>

        {pages.length > 1 && (
          /* Arrows around the dots rather than floating over the page: a
             control on top of the preview covers the thing it is there to let
             you look at, and on a phone it lands under a thumb that is trying
             to scroll. */
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => step(-1)}
              aria-label={prevLabel}
              className="icon-btn !h-9 !w-9"
            >
              <ChevronLeft className="flip-rtl h-4 w-4" />
            </button>

            <div className="flex items-center gap-2">
              {pages.map((page, i) => (
                <button
                  key={page.slug}
                  type="button"
                  onClick={() => {
                    setTaken(true);
                    setShown(i);
                  }}
                  aria-label={pickLabel.replace("{n}", String(i + 1))}
                  aria-current={i === shown}
                  className={`h-1.5 rounded-full transition-all ${
                    i === shown ? "w-6 bg-white/70" : "w-1.5 bg-white/25 hover:bg-white/40"
                  }`}
                />
              ))}
            </div>

            <button
              type="button"
              onClick={() => step(1)}
              aria-label={nextLabel}
              className="icon-btn !h-9 !w-9"
            >
              <ChevronRight className="flip-rtl h-4 w-4" />
            </button>
          </div>
        )}

        <p className="text-[11.5px] text-mist-600">{note}</p>
      </div>
    </div>
  );
}
