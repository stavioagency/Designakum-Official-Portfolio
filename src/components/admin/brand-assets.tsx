"use client";

import { useActionState, useRef } from "react";
import { deleteBrandAssetAction, uploadBrandAssetAction } from "@/app/actions/brand";
import { Status, Submit } from "@/components/editor/ui";
import { Check, Image as ImageIcon, Trash } from "@/components/icons";

export interface AssetSlot {
  name: string;
  description: string;
  url: string | null;
  /** Dark artwork needs a light plate behind it to be visible in this UI. */
  onLight?: boolean;
}

function Slot({ slot }: { slot: AssetSlot }) {
  const [uploadState, upload] = useActionState(uploadBrandAssetAction, null);
  const [deleteState, remove] = useActionState(deleteBrandAssetAction, null);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <li className="panel p-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <code dir="ltr" className="block text-[12.5px] text-mist-200">
            {slot.name}.*
          </code>
          <span className="mt-0.5 block text-[11.5px] leading-relaxed text-mist-500">
            {slot.description}
          </span>
        </div>
        <span
          className={`flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
            slot.url ? "bg-emerald-400/12 text-emerald-300" : "bg-amber-400/12 text-amber-300"
          }`}
        >
          {slot.url && <Check className="h-3 w-3" />}
          {slot.url ? "موجود" : "ناقص"}
        </span>
      </div>

      {slot.url && (
        <div
          className="mt-3 h-20 overflow-hidden rounded-xl p-3"
          style={{ background: slot.onLight ? "#f4f5f8" : "rgba(255,255,255,0.05)" }}
        >
          {/* An SVG with only a viewBox has no intrinsic size, so the box sets both. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={slot.url} alt={slot.name} className="h-full w-full object-contain" />
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <form ref={formRef} action={upload} className="contents">
          <input type="hidden" name="name" value={slot.name} />
          <input
            id={`brand-${slot.name}`}
            type="file"
            name="file"
            accept="image/svg+xml,image/png,image/webp,image/jpeg,image/avif"
            className="sr-only"
            onChange={() => formRef.current?.requestSubmit()}
          />
          <label
            htmlFor={`brand-${slot.name}`}
            className="btn btn-ghost !px-3 !py-1.5 !text-[12.5px]"
          >
            <ImageIcon className="h-4 w-4" />
            {slot.url ? "استبدال" : "رفع الملف"}
          </label>
          <Submit className="sr-only">رفع</Submit>
        </form>

        {slot.url && (
          <form action={remove}>
            <input type="hidden" name="name" value={slot.name} />
            <Submit className="btn btn-danger !px-3 !py-1.5 !text-[12.5px]" pendingLabel="…">
              <Trash className="h-4 w-4" />
            </Submit>
          </form>
        )}
      </div>

      <div className="mt-2 empty:hidden">
        <Status state={uploadState} />
        <Status state={deleteState} />
      </div>
    </li>
  );
}

export function BrandAssets({ slots }: { slots: AssetSlot[] }) {
  const missing = slots.filter((s) => !s.url).length;

  return (
    <section className="card p-5 sm:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">ملفات الهوية البصرية</h2>
          <p className="mt-1 text-[13px] leading-relaxed text-mist-400">
            ارفع شعار ديزاينكم هنا ليظهر في كل أنحاء المنصة. ما لم يُرفع بعد يظهر مكانه نص مؤقت.
            الملفات تُحفظ في <code dir="ltr" className="text-mist-300">public/brand/</code>.
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-3 py-1.5 text-[12px] font-semibold ${
            missing === 0 ? "bg-emerald-400/12 text-emerald-300" : "bg-amber-400/12 text-amber-300"
          }`}
        >
          {missing === 0 ? "مكتملة" : `${missing} ناقص`}
        </span>
      </header>

      <ul className="mt-5 grid gap-3 sm:grid-cols-2">
        {slots.map((slot) => (
          <Slot key={slot.name} slot={slot} />
        ))}
      </ul>
    </section>
  );
}
