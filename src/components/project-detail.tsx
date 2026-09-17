"use client";

import { useEffect, useRef, useState } from "react";
import { ExternalLink, X } from "./icons";
import type { Project, ProjectImageRow } from "@/lib/types";

/**
 * The whole of an item, rather than the corner of it that fits on a card.
 *
 * A card can only show a thumbnail, a title and two clipped lines, which is
 * enough to browse and not enough to decide. Opening one gives the description
 * in full, at a size where the image is worth looking at.
 *
 * A native `<dialog>` rather than a div: it takes the focus trap, the Escape
 * key, the backdrop and the inertness of everything behind it from the browser,
 * all of which are easy to write badly by hand.
 */
export function ProjectDetail({
  project,
  images,
  openLabel,
  closeLabel,
  visitLabel,
}: {
  project: Project;
  /** In order, the first being the main one. Empty falls back to the cover. */
  images?: ProjectImageRow[];
  openLabel: string;
  closeLabel: string;
  visitLabel: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);

  /**
   * The gallery, or the old single cover for a project that predates it.
   *
   * Written this way rather than migrating every caller: the cover column is
   * still what the card reads, and a project with no gallery rows should show
   * its picture rather than nothing.
   */
  const gallery: ProjectImageRow[] =
    images && images.length > 0
      ? images
      : project.image_url
        ? [{ id: project.id, project_id: project.id, url: project.image_url, width: 0, height: 0, position: 0 }]
        : [];

  // Closing can come from Escape or the backdrop as well as the button, so the
  // element is what the state follows rather than the other way round.
  useEffect(() => {
    const node = dialog.current;
    if (!node) return;
    const sync = () => setOpen(node.open);
    node.addEventListener("close", sync);
    return () => node.removeEventListener("close", sync);
  }, []);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  const show = () => {
    dialog.current?.showModal();
    setOpen(true);
  };

  return (
    <>
      <button
        type="button"
        onClick={show}
        className="absolute inset-0 z-10 cursor-pointer"
        aria-label={`${openLabel}: ${project.title}`}
      />

      <dialog
        ref={dialog}
        onClick={(event) => {
          // A click that lands on the dialog itself is the backdrop: the panel
          // inside it stops its own clicks from reaching here.
          if (event.target === dialog.current) dialog.current?.close();
        }}
        className="m-auto w-[min(92vw,640px)] rounded-[26px] bg-transparent p-0 backdrop:bg-black/70 backdrop:backdrop-blur-sm"
      >
        <div
          className="card overflow-hidden text-start"
          onClick={(event) => event.stopPropagation()}
        >
          {/*
            Every image, each at its own shape.

            A fixed box and `object-cover` crops somebody's work to fit a
            layout: a tall poster loses its top and bottom, a wide banner loses
            its ends. The real dimensions are read from the file when it is
            uploaded, so the space is reserved at the right ratio before the
            image arrives, which also means the dialog does not jump as they
            load. `object-contain` is the safety net for the rows migrated from
            the old single-image column, where the size was never recorded.
          */}
          {gallery.length > 0 && (
            <div className="max-h-[70vh] overflow-y-auto">
              {gallery.map((image, index) => (
                <img
                  // eslint-disable-next-line @next/next/no-img-element
                  key={image.id}
                  src={image.url}
                  alt={index === 0 ? project.title : ""}
                  loading={index === 0 ? "eager" : "lazy"}
                  width={image.width || undefined}
                  height={image.height || undefined}
                  className="block w-full object-contain"
                  style={
                    image.width && image.height
                      ? { aspectRatio: `${image.width} / ${image.height}` }
                      : undefined
                  }
                />
              ))}
            </div>
          )}

          <div className="space-y-3 p-5 sm:p-6">
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                {project.category && (
                  <p className="accent-text text-[12.5px] font-semibold">{project.category}</p>
                )}
                <h3 className="mt-1 text-xl font-bold leading-snug">{project.title}</h3>
              </div>
              <button
                type="button"
                onClick={() => dialog.current?.close()}
                className="icon-btn shrink-0"
                aria-label={closeLabel}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {project.description && (
              <p className="whitespace-pre-line text-[14.5px] leading-[1.9] text-mist-300">
                {project.description}
              </p>
            )}

            {project.link && (
              <a
                href={project.link}
                target="_blank"
                rel="noreferrer noopener nofollow ugc"
                data-track="project"
                className="btn btn-ghost w-full"
              >
                <ExternalLink className="h-4 w-4" />
                {visitLabel}
              </a>
            )}
          </div>
        </div>
      </dialog>
    </>
  );
}
