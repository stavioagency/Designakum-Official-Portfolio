"use client";

import { useActionState } from "react";
import { saveProfileAction } from "@/app/actions/portfolio";
import { THEMES, type Portfolio, type ThemeKey } from "@/lib/types";
import type { Dictionary } from "@/lib/i18n";
import { Field, Status, Submit } from "./ui";
import { ImageField } from "./image-field";
import { Check } from "@/components/icons";
import { accentFromHex } from "@/lib/accent";
import { surfaceFromHex } from "@/lib/surface";
import { useState } from "react";

/**
 * A spread rather than a palette: the platform's own ground, two darker
 * neutrals, two papers and two colours with a hue in them, so the row shows
 * that any colour works instead of implying these are the options.
 */
const BACKGROUNDS = ["#07080e", "#12121a", "#1c1b22", "#0f172a", "#f7f5f0", "#ffffff", "#1a2e23", "#2b1b1b"];

export function ProfileSection({
  portfolio,
  copy,
}: {
  portfolio: Portfolio;
  copy: Dictionary["dashboard"];
}) {
  const t = copy.profile;
  const [state, action] = useActionState(saveProfileAction, null);
  const [theme, setTheme] = useState<ThemeKey>(portfolio.theme);
  // The typed value is kept raw so a half-finished "#D5" does not clear the
  // preview on every keystroke; only a complete colour is applied.
  const [hex, setHex] = useState(portfolio.accent_hex);
  const custom = accentFromHex(hex);
  const [bg, setBg] = useState(portfolio.background_hex);
  const surface = surfaceFromHex(bg);

  return (
    <div className="space-y-5">
      <form action={action} className="card space-y-5 p-5 sm:p-6">
        <header>
          <h2 className="text-lg font-semibold">{t.heading}</h2>
          <p className="mt-1 text-[13px] text-mist-400">{t.description}</p>
        </header>

        <input type="hidden" name="portfolioId" value={portfolio.id} />
        <input type="hidden" name="theme" value={theme} />

        <div className="grid gap-5 sm:grid-cols-[180px_1fr]">
          <div className="space-y-2">
            <ImageField
              name="avatar"
              current={portfolio.avatar_url}
              label={t.avatar}
              aspect={1}
              chrome={{
                choose: copy.common.choose,
                replace: copy.common.replace,
                clear: copy.common.clear,
                cropTitle: copy.common.cropTitle,
                cropHint: copy.common.cropHint,
                zoom: copy.common.zoom,
                cancel: copy.common.cancel,
                confirmCrop: copy.common.confirmCrop,
                pending: copy.common.pending,
              }}
            />
            <Field label={t.monogram} hint={t.monogramHint}>
              <input name="monogram" defaultValue={portfolio.monogram} maxLength={2} className="field text-center" />
            </Field>
          </div>

          <div className="space-y-4">
            <Field label={t.name}>
              <input name="name" defaultValue={portfolio.name} className="field" required />
            </Field>
            <Field label={t.title}>
              <input
                name="title"
                defaultValue={portfolio.title}
                className="field"
                placeholder={t.titlePlaceholder}
              />
            </Field>
            <Field label={t.tagline}>
              <input
                name="tagline"
                defaultValue={portfolio.tagline}
                className="field"
                placeholder={t.taglinePlaceholder}
              />
            </Field>
          </div>
        </div>

        <Field label={t.bio}>
          <textarea name="bio" defaultValue={portfolio.bio} rows={5} className="field" />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t.whatsapp} hint={t.whatsappHint}>
            <input name="whatsapp" defaultValue={portfolio.whatsapp} className="field" dir="ltr" placeholder="966500000000" />
          </Field>
          <Field label={t.whatsappLabel}>
            <input name="whatsapp_label" defaultValue={portfolio.whatsapp_label} className="field" />
          </Field>
        </div>

        <Field label={t.footer}>
          <input
            name="footer_note"
            defaultValue={portfolio.footer_note}
            className="field"
            placeholder={t.footerPlaceholder}
          />
        </Field>

        <Field label={t.accent}>
          <div className="flex flex-wrap gap-2.5">
            {/* The colour is the label. Seven names spelled out said nothing the
                swatch does not, and only one of the two spellings was ever the
                reader's language — the name now lives in the accessible label. */}
            {(Object.keys(THEMES) as ThemeKey[]).map((key) => {
              const swatch = THEMES[key];
              const active = !custom && theme === key;
              return (
                <button
                  type="button"
                  key={key}
                  onClick={() => {
                    setTheme(key);
                    setHex("");
                  }}
                  aria-pressed={active}
                  aria-label={copy.profile.themes[key]}
                  title={copy.profile.themes[key]}
                  className={`grid h-10 w-10 place-items-center rounded-full border-2 transition ${
                    active ? "border-white/70 scale-105" : "border-white/10 hover:border-white/30"
                  }`}
                  style={{ backgroundImage: `linear-gradient(135deg, ${swatch.from}, ${swatch.to})` }}
                >
                  {active && <Check className="h-4 w-4 text-white drop-shadow" />}
                </button>
              );
            })}
          </div>

          {/* One colour in, a gradient and a ring out. Asking for three hex
              codes would be asking a customer to do colour theory. */}
          <input type="hidden" name="accent_hex" value={custom ? custom.from : ""} />
          <div className="mt-3.5 flex flex-wrap items-center gap-2.5">
            <label className="text-[12.5px] text-mist-400" htmlFor="accent-hex">
              {copy.profile.customColour}
            </label>
            <div className="field flex items-center gap-2 !w-auto !py-1.5" dir="ltr">
              <span
                className="h-6 w-6 shrink-0 rounded-md border border-white/15"
                style={{
                  backgroundImage: custom
                    ? `linear-gradient(135deg, ${custom.from}, ${custom.to})`
                    : undefined,
                  background: custom ? undefined : "rgba(255,255,255,0.06)",
                }}
              />
              <input
                id="accent-hex"
                value={hex}
                onChange={(event) => setHex(event.target.value)}
                placeholder="#D56637"
                maxLength={7}
                spellCheck={false}
                className="w-[92px] bg-transparent text-[13px] font-medium text-mist-50 outline-none"
              />
            </div>
            {hex && !custom && (
              <span className="text-[12px] text-rose-300">{copy.profile.colourInvalid}</span>
            )}
            {custom && (
              <button
                type="button"
                onClick={() => setHex("")}
                className="text-[12px] text-mist-500 underline underline-offset-4 hover:text-mist-300"
              >
                {copy.profile.colourClear}
              </button>
            )}
          </div>
        </Field>

        <Field label={t.worksLabel} hint={t.worksLabelHint}>
          <input
            name="works_label"
            defaultValue={portfolio.works_label}
            className="field"
            maxLength={40}
            placeholder={t.worksLabelPlaceholder}
          />
        </Field>

        <Field label={t.background}>
          <p className="mb-2.5 text-[12.5px] leading-relaxed text-mist-400">{t.backgroundHint}</p>

          <div className="flex flex-wrap gap-2.5">
            {BACKGROUNDS.map((swatch) => {
              const active = bg.toLowerCase() === swatch.toLowerCase();
              return (
                <button
                  type="button"
                  key={swatch}
                  onClick={() => setBg(swatch)}
                  aria-pressed={active}
                  aria-label={swatch}
                  title={swatch}
                  className={`grid h-10 w-10 place-items-center rounded-full border-2 transition ${
                    active ? "border-white/70 scale-105" : "border-white/10 hover:border-white/30"
                  }`}
                  style={{ background: swatch }}
                >
                  {active && <Check className="h-4 w-4 text-white mix-blend-difference" />}
                </button>
              );
            })}
          </div>

          <input type="hidden" name="background_hex" value={surface ? surface.page : ""} />
          <div className="mt-3.5 flex flex-wrap items-center gap-2.5">
            <label className="text-[12.5px] text-mist-400" htmlFor="background-hex">
              {t.customColour}
            </label>
            <div className="field flex items-center gap-2 !w-auto !py-1.5" dir="ltr">
              <span
                className="h-6 w-6 shrink-0 rounded-md border border-white/15"
                style={{ background: surface ? surface.page : "rgba(255,255,255,0.06)" }}
              />
              <input
                id="background-hex"
                value={bg}
                onChange={(event) => setBg(event.target.value)}
                placeholder="#0F172A"
                maxLength={7}
                spellCheck={false}
                className="w-[92px] bg-transparent text-[13px] font-medium text-mist-50 outline-none"
              />
            </div>
            {bg && !surface && (
              <span className="text-[12px] text-rose-300">{t.colourInvalid}</span>
            )}
            {surface && (
              <button
                type="button"
                onClick={() => setBg("")}
                className="text-[12px] text-mist-500 underline underline-offset-4 hover:text-mist-300"
              >
                {t.backgroundReset}
              </button>
            )}
          </div>

          {/* Whatever they pick, the text tones are measured against it — this
              says which way the page just flipped, so the change is not a
              surprise when they look at the preview. */}
          {surface && (
            <p className="mt-2.5 text-[12px] text-mist-500">
              {surface.isLight ? t.backgroundLight : t.backgroundDark}
            </p>
          )}
        </Field>

        {/*
          Every one of these is optional, and the hint says what happens when it
          is left alone — a page describes itself from the name, the bio and the
          avatar, which is usually better than a field somebody half-filled.
        */}
        <Field label={t.seoHeading} hint={t.seoHint}>
          <div className="space-y-3">
            <input
              name="seo_title"
              defaultValue={portfolio.seo_title}
              className="field"
              maxLength={60}
              placeholder={`${portfolio.name} — ${portfolio.title}`}
            />
            <textarea
              name="seo_description"
              defaultValue={portfolio.seo_description}
              className="field"
              rows={2}
              maxLength={160}
              placeholder={t.seoDescriptionPlaceholder}
            />
            <input
              name="og_image_url"
              defaultValue={portfolio.og_image_url}
              className="field"
              dir="ltr"
              placeholder={t.seoImagePlaceholder}
            />
          </div>
        </Field>

        <div className="flex flex-wrap items-center gap-3">
          <Submit pendingLabel={copy.common.saving}>{copy.common.save}</Submit>
          <Status state={state} />
        </div>
      </form>

    </div>
  );
}
