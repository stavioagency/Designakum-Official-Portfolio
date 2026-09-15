"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Renders into `document.body`.
 *
 * This is not decoration: an ancestor with `backdrop-filter` becomes the
 * containing block for `position: fixed` descendants, so a dialog written inline
 * inside a `.card` is clipped to that card instead of covering the viewport.
 * Portalling out of the blurred subtree is what makes the overlay behave.
 */
export function Modal({
  onClose,
  children,
  className = "",
}: {
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  if (!mounted) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal
      dir="rtl"
      className={`fixed inset-0 z-[90] grid place-items-center overflow-y-auto bg-black/80 p-4 backdrop-blur-sm ${className}`}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      {children}
    </div>,
    document.body,
  );
}
