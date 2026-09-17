"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { placePanel } from "@/lib/popover";
import { X } from "@/components/icons";

/**
 * A walk through the studio, over the studio.
 *
 * Not a help page: a page of screenshots goes out of date the week after it is
 * written, and a person reading it is not in the product. This points at the
 * real controls, on their own portfolio, and changes tabs as it goes, so the
 * thing being described is the thing on screen.
 *
 * It runs once, tracked on the account rather than in the browser, so somebody
 * who set their page up on a laptop is not walked through it again on their
 * phone. Escape, the backdrop and the skip button all end it, and it can be
 * started again from the button beside the tabs, because a tour nobody can
 * leave or repeat is worse than no tour.
 */

export interface TourStep {
  /** Which editor tab to open before this step. */
  tab?: string;
  /** `data-tour` value of the element to point at. */
  target: string;
  title: string;
  body: string;
}

export interface TourChrome {
  next: string;
  back: string;
  done: string;
  skip: string;
  /** "{n} of {total}" */
  progress: string;
  start: string;
}

type Box = { top: number; left: number; width: number; height: number };

export function StudioTour({
  steps,
  chrome,
  autoStart,
  onTab,
  onFinish,
}: {
  steps: TourStep[];
  chrome: TourChrome;
  /** True the first time somebody opens the studio. */
  autoStart: boolean;
  onTab: (tab: string) => void;
  /** Records that they have seen it, so it does not come back. */
  onFinish: () => void;
}) {
  const [running, setRunning] = useState(false);
  const [index, setIndex] = useState(0);
  const [hole, setHole] = useState<Box | null>(null);
  const [card, setCard] = useState<{ top?: number; bottom?: number; left: number; width: number } | null>(null);
  const finished = useRef(false);

  const step = steps[index];

  const stop = useCallback(() => {
    setRunning(false);
    setHole(null);
    if (!finished.current) {
      finished.current = true;
      onFinish();
    }
  }, [onFinish]);

  // Auto-start once, and only after the editor has had a frame to lay itself
  // out: measuring an element that is still arriving gives a box in the wrong
  // place, and the first thing a new customer would see is a hole around
  // nothing.
  useEffect(() => {
    if (!autoStart) return;
    const timer = setTimeout(() => setRunning(true), 600);
    return () => clearTimeout(timer);
  }, [autoStart]);

  // Switching tab is a render of somebody else's component, so the measurement
  // waits for it rather than racing it.
  useEffect(() => {
    if (!running || !step?.tab) return;
    onTab(step.tab);
  }, [running, step?.tab, onTab]);

  const place = useCallback(() => {
    if (!running || !step) return;
    const node = document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`);
    const rect = node?.getBoundingClientRect();

    /**
     * A step whose subject is not on this screen is skipped, not shown.
     *
     * The live preview is desktop only, so on a phone that element is in the
     * document with no box at all. Pointing at it would cut an eight-pixel
     * hole in the top corner and describe something the reader cannot see, so
     * the tour simply moves on and ends a step early.
     */
    if (!node || !rect || (rect.width === 0 && rect.height === 0)) {
      setHole(null);
      setCard(null);
      setIndex((was) => {
        if (was + 1 >= steps.length) {
          stop();
          return was;
        }
        return was + 1;
      });
      return;
    }

    const pad = 8;
    setHole({
      top: rect.top - pad,
      left: rect.left - pad,
      width: rect.width + pad * 2,
      height: rect.height + pad * 2,
    });

    // The same placement the notifications panel uses: prefers below, flips
    // above when that is where the room is, and stays on screen either way.
    const placed = placePanel(
      { top: rect.top - pad, bottom: rect.bottom + pad, right: rect.right },
      { width: window.innerWidth, height: window.innerHeight },
      { width: 340 },
    );
    setCard({ top: placed.top, bottom: placed.bottom, left: placed.left, width: placed.width });
  }, [running, step, steps.length, stop]);

  useEffect(() => {
    if (!running) return;

    const node = document.querySelector<HTMLElement>(`[data-tour="${step?.target}"]`);
    node?.scrollIntoView({ block: "center", behavior: "smooth" });

    // After the scroll and after any tab switch has painted.
    const settle = setTimeout(place, 320);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      clearTimeout(settle);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [running, index, place, step?.target]);

  useEffect(() => {
    if (!running) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") stop();
      if (event.key === "ArrowRight" || event.key === "ArrowLeft") event.preventDefault();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [running, stop]);

  const start = () => {
    finished.current = false;
    setIndex(0);
    setRunning(true);
  };

  const next = () => (index + 1 >= steps.length ? stop() : setIndex(index + 1));

  return (
    <>
      <button
        type="button"
        onClick={start}
        className="shrink-0 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-[13.5px] font-medium text-mist-400 transition hover:bg-white/[0.07] hover:text-white"
      >
        {chrome.start}
      </button>

      {running &&
        step &&
        createPortal(
          <div className="fixed inset-0 z-[200]" role="dialog" aria-modal="true" aria-label={step.title}>
            {/*
              One element does the dimming and the cut-out: a huge spread shadow
              around a transparent box. Four divs around the target drift apart
              by a pixel at some zoom levels, and a clip-path cannot be animated
              between steps.
            */}
            {hole && (
              <div
                className="pointer-events-none absolute rounded-2xl transition-all duration-200"
                style={{
                  top: hole.top,
                  left: hole.left,
                  width: hole.width,
                  height: hole.height,
                  boxShadow: "0 0 0 9999px rgba(3, 4, 9, 0.72)",
                  outline: "2px solid var(--accent-ring)",
                  outlineOffset: "-1px",
                }}
              />
            )}

            {/* Clicking anywhere outside the card leaves, which is what people try. */}
            <button
              type="button"
              aria-label={chrome.skip}
              onClick={stop}
              className="absolute inset-0 h-full w-full cursor-default"
            />

            {card && (
              <div
                style={{ position: "fixed", top: card.top, bottom: card.bottom, left: card.left, width: card.width }}
                className="rounded-2xl border border-white/12 bg-ink-900 p-4 shadow-2xl"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-[14.5px] font-semibold leading-snug">{step.title}</p>
                  <button
                    type="button"
                    onClick={stop}
                    aria-label={chrome.skip}
                    className="icon-btn !h-7 !w-7 shrink-0"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>

                <p className="mt-2 text-[13px] leading-relaxed text-mist-400">{step.body}</p>

                <div className="mt-4 flex items-center justify-between gap-3">
                  <span className="tnum text-[12px] text-mist-600">
                    {chrome.progress
                      .replace("{n}", String(index + 1))
                      .replace("{total}", String(steps.length))}
                  </span>

                  <div className="flex items-center gap-2">
                    {index > 0 && (
                      <button type="button" onClick={() => setIndex(index - 1)} className="btn btn-ghost !py-2 !text-[13px]">
                        {chrome.back}
                      </button>
                    )}
                    <button type="button" onClick={next} className="btn btn-primary !py-2 !text-[13px]">
                      {index + 1 >= steps.length ? chrome.done : chrome.next}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>,
          document.body,
        )}
    </>
  );
}
