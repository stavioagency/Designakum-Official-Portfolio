"use client";

import { useEffect, useRef, useState } from "react";
import { ExternalLink, X } from "./icons";
import type { Project } from "@/lib/types";

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
  openLabel,
  closeLabel,
  visitLabel,
}: {
  project: Project;
  openLabel: string;
  closeLabel: string;
  visitLabel: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);

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
          {project.image_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={project.image_url}
              alt={project.title}
              className="max-h-[52vh] w-full object-cover"
            />
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
