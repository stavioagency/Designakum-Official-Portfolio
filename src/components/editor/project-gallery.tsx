"use client";

import { useActionState, useRef } from "react";
import {
  addProjectImageAction,
  moveProjectImageAction,
  removeProjectImageAction,
} from "@/app/actions/portfolio";
import { ChevronLeft, ChevronRight, Plus, Star, Trash } from "@/components/icons";
import { Status } from "./ui";
import type { ProjectImage } from "@/lib/project-images";

export interface GalleryChrome {
  heading: string;
  hint: string;
  add: string;
  adding: string;
  main: string;
  makeMain: string;
  earlier: string;
  later: string;
  remove: string;
  empty: string;
}

/**
 * Every image on one project, edited a picture at a time.
 *
 * Each control is its own form posting to its own action, so adding a photo
 * does not save the project's text and deleting one cannot take the rest of an
 * unsaved edit with it. It also has to live outside the project's save form:
 * a form inside a form is not valid HTML, and browsers resolve it by dropping
 * the inner one, which would have made every button here do nothing.
 *
 * The first image is the main one. That is a position rather than a flag, so
 * there can never be two main images, or none.
 */
export function ProjectGallery({
  portfolioId,
  projectId,
  images,
  chrome,
}: {
  portfolioId: string;
  projectId: string;
  images: ProjectImage[];
  chrome: GalleryChrome;
}) {
  const [addState, add] = useActionState(addProjectImageAction, null);
  const [, remove] = useActionState(removeProjectImageAction, null);
  const [, move] = useActionState(moveProjectImageAction, null);
  const picker = useRef<HTMLInputElement>(null);
  const addForm = useRef<HTMLFormElement>(null);

  const ids = (
    <>
      <input type="hidden" name="portfolioId" value={portfolioId} />
      <input type="hidden" name="projectId" value={projectId} />
    </>
  );

  return (
    <div className="panel p-4">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-[13px] font-semibold text-mist-300">{chrome.heading}</p>
        <p className="text-[12px] text-mist-500">{chrome.hint}</p>
      </div>

      {images.length === 0 ? (
        <p className="py-3 text-[12.5px] text-mist-500">{chrome.empty}</p>
      ) : (
        <ul className="flex flex-wrap gap-3">
          {images.map((image, index) => (
            <li key={image.id} className="w-[104px]">
              <div
                className={`relative overflow-hidden rounded-xl border ${
                  index === 0 ? "border-white/40" : "border-white/10"
                }`}
                /* The real shape of the picture, so the strip shows what the
                   page will show rather than a row of identical squares. */
                style={{ aspectRatio: image.width && image.height ? `${image.width} / ${image.height}` : "1 / 1" }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={image.url} alt="" className="h-full w-full object-cover" />
                {index === 0 && (
                  <span className="absolute inset-x-0 bottom-0 bg-black/65 py-0.5 text-center text-[10.5px] font-semibold text-white">
                    {chrome.main}
                  </span>
                )}
              </div>

              <div className="mt-1.5 flex items-center justify-center gap-1">
                {index > 0 && (
                  <form action={move}>
                    {ids}
                    <input type="hidden" name="imageId" value={image.id} />
                    <input type="hidden" name="to" value="0" />
                    <button type="submit" title={chrome.makeMain} aria-label={chrome.makeMain} className="icon-btn !h-7 !w-7">
                      <Star className="h-3.5 w-3.5" />
                    </button>
                  </form>
                )}
                {index > 0 && (
                  <form action={move}>
                    {ids}
                    <input type="hidden" name="imageId" value={image.id} />
                    <input type="hidden" name="to" value={index - 1} />
                    <button type="submit" title={chrome.earlier} aria-label={chrome.earlier} className="icon-btn !h-7 !w-7">
                      <ChevronLeft className="flip-rtl h-3.5 w-3.5" />
                    </button>
                  </form>
                )}
                {index < images.length - 1 && (
                  <form action={move}>
                    {ids}
                    <input type="hidden" name="imageId" value={image.id} />
                    <input type="hidden" name="to" value={index + 1} />
                    <button type="submit" title={chrome.later} aria-label={chrome.later} className="icon-btn !h-7 !w-7">
                      <ChevronRight className="flip-rtl h-3.5 w-3.5" />
                    </button>
                  </form>
                )}
                <form action={remove}>
                  {ids}
                  <input type="hidden" name="imageId" value={image.id} />
                  <button type="submit" title={chrome.remove} aria-label={chrome.remove} className="icon-btn !h-7 !w-7 hover:!text-rose-300">
                    <Trash className="h-3.5 w-3.5" />
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Submits as soon as a file is chosen: a separate upload button after the
          file picker is a step that exists only because the form needs it. */}
      <form action={add} ref={addForm} className="mt-3">
        {ids}
        <input
          ref={picker}
          type="file"
          name="image"
          accept="image/png,image/jpeg,image/webp,image/avif,image/gif"
          className="sr-only"
          onChange={() => addForm.current?.requestSubmit()}
        />
        <button type="button" onClick={() => picker.current?.click()} className="btn btn-ghost !py-2 text-[13px]">
          <Plus className="h-4 w-4" />
          {chrome.add}
        </button>
      </form>

      <Status state={addState} />
    </div>
  );
}
