import { Check, Image as ImageIcon } from "@/components/icons";
import { fill, type Dictionary } from "@/lib/i18n";

type Copy = Dictionary["console"]["brandAssets"];

export interface AssetSlot {
  name: string;
  description: string;
  url: string | null;
  /** Dark artwork needs a light plate behind it to be visible in this UI. */
  onLight?: boolean;
}

/**
 * Which brand artwork is installed, and which slots are still empty.
 *
 * This used to offer upload and delete buttons. They wrote to the server's local
 * disk, which every deployment target this app runs on wipes between requests —
 * so the upload reported success and the file was gone before the next page
 * load. A control that lies is worse than no control, and artwork that changes
 * once a year does not need a runtime uploader; it lives in the repository,
 * where it is reviewed and versioned like everything else.
 *
 * The checklist is the part that was always worth having, so it stays, and it
 * no longer needs to be a client component.
 */
function Slot({ slot, copy }: { slot: AssetSlot; copy: Copy }) {
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
          {slot.url ? copy.present : copy.missing}
        </span>
      </div>

      {slot.url ? (
        <div
          className="mt-3 h-20 overflow-hidden rounded-xl p-3"
          style={{ background: slot.onLight ? "#f4f5f8" : "rgba(255,255,255,0.05)" }}
        >
          {/* An SVG with only a viewBox has no intrinsic size, so the box sets both. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={slot.url} alt={slot.name} className="h-full w-full object-contain" />
        </div>
      ) : (
        <div className="mt-3 grid h-20 place-items-center rounded-xl border border-dashed border-white/10 text-mist-600">
          <ImageIcon className="h-5 w-5" />
        </div>
      )}
    </li>
  );
}

export function BrandAssets({ slots, copy }: { slots: AssetSlot[]; copy: Copy }) {
  const missing = slots.filter((s) => !s.url).length;

  return (
    <section className="card p-5 sm:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{copy.title}</h2>
          <p className="mt-1 text-[13px] leading-relaxed text-mist-400">
            {copy.description} <code dir="ltr" className="text-mist-300">public/brand/</code>.
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-3 py-1.5 text-[12px] font-semibold ${
            missing === 0 ? "bg-emerald-400/12 text-emerald-300" : "bg-amber-400/12 text-amber-300"
          }`}
        >
          {missing === 0 ? copy.complete : fill(copy.missingCount, { n: missing })}
        </span>
      </header>

      <ul className="mt-5 grid gap-3 sm:grid-cols-2">
        {slots.map((slot) => (
          <Slot key={slot.name} slot={slot} copy={copy} />
        ))}
      </ul>
    </section>
  );
}
