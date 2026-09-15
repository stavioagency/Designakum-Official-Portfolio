"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Image as ImageIcon, Plus, Trash } from "@/components/icons";
import { Field } from "./ui";
import { Modal } from "@/components/ui/modal";

const OUTPUT_WIDTH = 1400;
const OUTPUT_TYPE = "image/webp";

type Point = { x: number; y: number };

/**
 * Upload + crop in one control. The visitor picks a file, frames it by dragging
 * and zooming, and the cropped result is written back into the real file input
 * that the surrounding form submits — so the server only ever receives the image
 * the client actually chose to show.
 */
export function ImageField({
  name,
  current,
  label = "الصورة",
  aspect = 16 / 9,
  hint,
}: {
  name: string;
  current?: string;
  label?: string;
  /** Width ÷ height of the crop frame. */
  aspect?: number;
  hint?: string;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [source, setSource] = useState<string | null>(null);
  const [cleared, setCleared] = useState(false);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  const applyCrop = useCallback((file: File) => {
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(file);
    if (fileInputRef.current) fileInputRef.current.files = dataTransfer.files;
    setPreview((old) => {
      if (old) URL.revokeObjectURL(old);
      return URL.createObjectURL(file);
    });
    setCleared(false);
  }, []);

  const shown = preview ?? (cleared ? null : current || null);

  return (
    <Field label={label} hint={hint}>
      <div
        className="group relative w-full overflow-hidden rounded-2xl border border-dashed border-white/15 bg-white/[0.03] transition hover:border-white/30"
        style={{ aspectRatio: String(aspect) }}
      >
        {shown && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={shown} alt="" className="absolute inset-0 h-full w-full object-cover" />
        )}

        <div
          className={`absolute inset-0 flex items-center justify-center gap-2 transition ${
            shown ? "bg-black/55 opacity-0 group-hover:opacity-100" : ""
          }`}
        >
          <button
            type="button"
            onClick={() => document.getElementById(`${name}-picker`)?.click()}
            className="btn btn-ghost !px-3.5 !py-2 !text-[12.5px]"
          >
            {shown ? <ImageIcon className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {shown ? "استبدال" : "اختر صورة"}
          </button>

          {shown && (
            <button
              type="button"
              onClick={() => {
                if (fileInputRef.current) fileInputRef.current.value = "";
                setPreview((old) => {
                  if (old) URL.revokeObjectURL(old);
                  return null;
                });
                setCleared(true);
              }}
              className="btn btn-danger !px-3 !py-2 !text-[12.5px]"
            >
              <Trash className="h-4 w-4" />
              إزالة
            </button>
          )}
        </div>
      </div>

      {/* The input the form actually submits — filled with the cropped result. */}
      <input ref={fileInputRef} type="file" name={name} accept="image/*" className="sr-only" tabIndex={-1} />
      {/* Signals an intentional removal, which the action distinguishes from "unchanged". */}
      {cleared && <input type="hidden" name={`${name}_cleared`} value="1" />}

      <input
        id={`${name}-picker`}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/avif,image/gif"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (!file) return;
          setSource(URL.createObjectURL(file));
        }}
      />

      {source && (
        <Cropper
          src={source}
          aspect={aspect}
          onCancel={() => {
            URL.revokeObjectURL(source);
            setSource(null);
          }}
          onDone={(file) => {
            URL.revokeObjectURL(source);
            setSource(null);
            applyCrop(file);
          }}
        />
      )}
    </Field>
  );
}

function Cropper({
  src,
  aspect,
  onDone,
  onCancel,
}: {
  src: string;
  aspect: number;
  onDone: (file: File) => void;
  onCancel: () => void;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState<Point>({ x: 0, y: 0 });
  const [frame, setFrame] = useState({ width: 0, height: 0 });
  const drag = useRef<{ start: Point; origin: Point } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const element = new window.Image();
    element.onload = () => setImage(element);
    element.src = src;
  }, [src]);

  useEffect(() => {
    const measure = () => {
      const box = frameRef.current?.getBoundingClientRect();
      if (box) setFrame({ width: box.width, height: box.height });
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [image]);

  // "Cover" scale: the smallest scale at which the image fills the frame.
  const base =
    image && frame.width
      ? Math.max(frame.width / image.naturalWidth, frame.height / image.naturalHeight)
      : 1;
  const scale = base * zoom;
  const drawn = image
    ? { width: image.naturalWidth * scale, height: image.naturalHeight * scale }
    : { width: 0, height: 0 };

  const clamp = useCallback(
    (point: Point): Point => ({
      x: Math.min(0, Math.max(frame.width - drawn.width, point.x)),
      y: Math.min(0, Math.max(frame.height - drawn.height, point.y)),
    }),
    [frame.width, frame.height, drawn.width, drawn.height],
  );

  useEffect(() => {
    // Re-centre whenever the zoom changes so the frame never shows empty space.
    setOffset((current) =>
      clamp({
        x: current.x || (frame.width - drawn.width) / 2,
        y: current.y || (frame.height - drawn.height) / 2,
      }),
    );
  }, [clamp, frame.width, frame.height, drawn.width, drawn.height]);

  async function confirm() {
    if (!image) return;
    setBusy(true);

    const outWidth = OUTPUT_WIDTH;
    const outHeight = Math.round(OUTPUT_WIDTH / aspect);
    const factor = outWidth / frame.width;

    const canvas = document.createElement("canvas");
    canvas.width = outWidth;
    canvas.height = outHeight;
    const context = canvas.getContext("2d")!;
    context.imageSmoothingQuality = "high";
    context.drawImage(
      image,
      offset.x * factor,
      offset.y * factor,
      drawn.width * factor,
      drawn.height * factor,
    );

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, OUTPUT_TYPE, 0.92),
    );
    setBusy(false);
    if (blob) onDone(new File([blob], "image.webp", { type: OUTPUT_TYPE }));
  }

  return (
    <Modal onClose={onCancel}>
      <div className="card w-full max-w-lg p-5">
        <h3 className="mb-1 text-[15px] font-semibold">قصّ الصورة</h3>
        <p className="mb-4 text-[12.5px] text-mist-500">اسحب الصورة لتحريكها، واستخدم الشريط للتكبير.</p>

        <div
          ref={frameRef}
          className="relative w-full cursor-grab overflow-hidden rounded-2xl bg-ink-900 active:cursor-grabbing"
          style={{ aspectRatio: String(aspect), touchAction: "none" }}
          onPointerDown={(event) => {
            (event.target as HTMLElement).setPointerCapture(event.pointerId);
            drag.current = { start: { x: event.clientX, y: event.clientY }, origin: offset };
          }}
          onPointerMove={(event) => {
            if (!drag.current) return;
            setOffset(
              clamp({
                x: drag.current.origin.x + (event.clientX - drag.current.start.x),
                y: drag.current.origin.y + (event.clientY - drag.current.start.y),
              }),
            );
          }}
          onPointerUp={() => {
            drag.current = null;
          }}
        >
          {image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={src}
              alt=""
              draggable={false}
              className="absolute max-w-none select-none"
              style={{
                width: drawn.width,
                height: drawn.height,
                left: offset.x,
                top: offset.y,
              }}
            />
          )}
          <div className="pointer-events-none absolute inset-0 border border-white/15" />
        </div>

        <label className="mt-4 flex items-center gap-3">
          <span className="text-[12px] text-mist-500">تكبير</span>
          <input
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={zoom}
            onChange={(event) => setZoom(Number(event.target.value))}
            className="h-1.5 flex-1 accent-[var(--accent-from)]"
          />
        </label>

        <div className="mt-5 flex items-center justify-end gap-2">
          <button type="button" onClick={onCancel} className="btn btn-ghost">
            إلغاء
          </button>
          <button type="button" onClick={confirm} disabled={!image || busy} className="btn btn-primary">
            <Check className="h-4 w-4" />
            {busy ? "لحظة…" : "اعتماد الصورة"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
