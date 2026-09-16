"use client";

import { useActionState } from "react";
import { saveProfileAction } from "@/app/actions/portfolio";
import { THEMES, type Portfolio, type ThemeKey } from "@/lib/types";
import type { Dictionary } from "@/lib/i18n";
import { Field, Status, Submit } from "./ui";
import { ImageField } from "./image-field";
import { Check } from "@/components/icons";
import { useState } from "react";

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
              const active = theme === key;
              return (
                <button
                  type="button"
                  key={key}
                  onClick={() => setTheme(key)}
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
        </Field>

        <div className="flex flex-wrap items-center gap-3">
          <Submit pendingLabel={copy.common.saving}>{copy.common.save}</Submit>
          <Status state={state} />
        </div>
      </form>

    </div>
  );
}
