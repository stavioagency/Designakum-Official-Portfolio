"use client";

import { useActionState } from "react";
import { saveProfileAction } from "@/app/actions/portfolio";
import { THEMES, type Portfolio, type ThemeKey } from "@/lib/types";
import { Field, Status, Submit } from "./ui";
import { ImageField } from "./image-field";
import { useState } from "react";

export function ProfileSection({ portfolio }: { portfolio: Portfolio }) {
  const [state, action] = useActionState(saveProfileAction, null);
  const [theme, setTheme] = useState<ThemeKey>(portfolio.theme);

  return (
    <div className="space-y-5">
      <form action={action} className="card space-y-5 p-5 sm:p-6">
        <header>
          <h2 className="text-lg font-semibold">الملف الشخصي</h2>
          <p className="mt-1 text-[13px] text-mist-400">
            هذه المعلومات تظهر في أعلى صفحتك العامة.
          </p>
        </header>

        <input type="hidden" name="portfolioId" value={portfolio.id} />
        <input type="hidden" name="theme" value={theme} />

        <div className="grid gap-5 sm:grid-cols-[180px_1fr]">
          <div className="space-y-2">
            <ImageField name="avatar" current={portfolio.avatar_url} label="الصورة الشخصية" aspect={1} />
            <Field label="الحرف البديل" hint="يظهر مكان الصورة إذا لم ترفع واحدة.">
              <input name="monogram" defaultValue={portfolio.monogram} maxLength={2} className="field text-center" />
            </Field>
          </div>

          <div className="space-y-4">
            <Field label="الاسم">
              <input name="name" defaultValue={portfolio.name} className="field" required />
            </Field>
            <Field label="التخصص">
              <input name="title" defaultValue={portfolio.title} className="field" placeholder="مصمم جرافيك | F9 Designer" />
            </Field>
            <Field label="جملة تعريفية قصيرة">
              <input name="tagline" defaultValue={portfolio.tagline} className="field" placeholder="خلّك دائمًا مميز مع تصميم يناسبك" />
            </Field>
          </div>
        </div>

        <Field label="نبذة عنك">
          <textarea name="bio" defaultValue={portfolio.bio} rows={5} className="field" />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="رقم واتساب" hint="بصيغة دولية بدون رموز، مثال: 966500000000">
            <input name="whatsapp" defaultValue={portfolio.whatsapp} className="field" dir="ltr" placeholder="966500000000" />
          </Field>
          <Field label="نص زر التواصل">
            <input name="whatsapp_label" defaultValue={portfolio.whatsapp_label} className="field" />
          </Field>
        </div>

        <Field label="نص حقوق النشر">
          <input name="footer_note" defaultValue={portfolio.footer_note} className="field" placeholder="جميع الحقوق محفوظة لـ ..." />
        </Field>

        <Field label="لون الهوية">
          <div className="flex flex-wrap gap-2.5">
            {(Object.keys(THEMES) as ThemeKey[]).map((key) => {
              const t = THEMES[key];
              const active = theme === key;
              return (
                <button
                  type="button"
                  key={key}
                  onClick={() => setTheme(key)}
                  className={`flex items-center gap-2 rounded-2xl border px-3 py-2 text-[12.5px] font-medium transition ${
                    active
                      ? "border-white/35 bg-white/10 text-white"
                      : "border-white/10 bg-white/[0.03] text-mist-400 hover:bg-white/[0.07]"
                  }`}
                >
                  <span
                    className="h-4 w-4 rounded-full"
                    style={{ backgroundImage: `linear-gradient(135deg, ${t.from}, ${t.to})` }}
                  />
                  {t.name}
                </button>
              );
            })}
          </div>
        </Field>

        <div className="flex flex-wrap items-center gap-3">
          <Submit>حفظ التغييرات</Submit>
          <Status state={state} />
        </div>
      </form>

    </div>
  );
}
