"use client";

import { useRef, useState } from "react";
import { Download } from "@/components/icons";

/**
 * Shows the page's QR code and hands it over in the two formats it is actually
 * used in: SVG for anything a printer touches, PNG for anything pasted into a
 * post or a slide.
 *
 * The SVG arrives from the server already rendered; the PNG is drawn from it
 * here, at a size worth printing, so no second round trip is needed and the two
 * cannot disagree about what they encode.
 */
export function QrCode({
  svg,
  url,
  filename,
  copy,
}: {
  svg: string;
  url: string;
  filename: string;
  copy: {
    heading: string;
    note: string;
    downloadSvg: string;
    downloadPng: string;
    forPrint: string;
  };
}) {
  const holder = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);

  const save = (href: string, name: string) => {
    const link = document.createElement("a");
    link.href = href;
    link.download = name;
    link.click();
  };

  const saveSvg = () => {
    const blob = new Blob([svg], { type: "image/svg+xml" });
    const href = URL.createObjectURL(blob);
    save(href, `${filename}.svg`);
    // Revoked on the next frame: doing it synchronously can beat the download.
    requestAnimationFrame(() => URL.revokeObjectURL(href));
  };

  /** 1024px square — large enough for a poster, small enough to attach. */
  const savePng = async () => {
    setBusy(true);
    try {
      const size = 1024;
      const image = new Image();

      // The encoder emits a viewBox and no width or height. Chromium rasterises
      // that anyway; Firefox has historically refused an SVG with no intrinsic
      // size, so the dimensions are written in before it becomes an image.
      const sized = svg.replace(/<svg\b/, `<svg width="${size}" height="${size}"`);
      const source = URL.createObjectURL(new Blob([sized], { type: "image/svg+xml" }));

      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error("QR image failed to load"));
        image.src = source;
      });

      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const context = canvas.getContext("2d");
      if (context) {
        // The SVG's own white is the quiet zone; painting the canvas first
        // means a transparent PNG never reaches a printer as grey.
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, size, size);
        context.drawImage(image, 0, 0, size, size);
        save(canvas.toDataURL("image/png"), `${filename}.png`);
      }
      URL.revokeObjectURL(source);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card space-y-4 p-5 sm:p-6">
      <header>
        <h2 className="text-lg font-semibold">{copy.heading}</h2>
        <p className="mt-1 text-[13px] leading-relaxed text-mist-400">{copy.note}</p>
      </header>

      <div className="flex flex-wrap items-center gap-5">
        <div
          ref={holder}
          className="h-[152px] w-[152px] shrink-0 overflow-hidden rounded-2xl bg-white p-2"
          // Rendered on the server by the same encoder that produced the file,
          // so what is on screen is exactly what downloads.
          dangerouslySetInnerHTML={{ __html: svg }}
        />

        <div className="min-w-0 flex-1 space-y-3">
          <p className="break-all text-[12.5px] text-mist-500" dir="ltr">
            {url}
          </p>
          <div className="flex flex-wrap gap-2.5">
            <button type="button" onClick={saveSvg} className="btn btn-ghost">
              <Download className="h-4 w-4" />
              {copy.downloadSvg}
            </button>
            <button type="button" onClick={savePng} disabled={busy} className="btn btn-ghost">
              <Download className="h-4 w-4" />
              {copy.downloadPng}
            </button>
          </div>
          <p className="text-[12px] leading-relaxed text-mist-500">{copy.forPrint}</p>
        </div>
      </div>
    </section>
  );
}
