"use client";

import { useState } from "react";
import { CollectionSection } from "./collection-section";
import { ProfileSection } from "./profile-section";
import { SettingsSection } from "./settings-section";
import { Field } from "./ui";
import { ImageField } from "./image-field";
import { SOCIAL_META, STAT_ICON_OPTIONS } from "@/components/icons";
import type { PortfolioBundle, SocialPlatform, User } from "@/lib/types";

const TABS = [
  { key: "profile", label: "الملف الشخصي" },
  { key: "slides", label: "الصور المميزة" },
  { key: "projects", label: "الأعمال" },
  { key: "stats", label: "الإحصائيات" },
  { key: "socials", label: "روابط التواصل" },
  { key: "settings", label: "الإعدادات" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export function Editor({
  bundle,
  user,
  origin,
  preview,
  hasPassword,
  canPublish,
}: {
  bundle: PortfolioBundle;
  user: User;
  origin: string;
  preview: React.ReactNode;
  hasPassword: boolean;
  canPublish: boolean;
}) {
  const [tab, setTab] = useState<TabKey>("profile");
  const { portfolio, slides, projects, stats, socials } = bundle;

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_400px] xl:items-start">
      <div className="min-w-0 space-y-5">
        <nav className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`shrink-0 rounded-2xl border px-4 py-2.5 text-[13.5px] font-medium transition ${
                tab === t.key
                  ? "accent-grad border-transparent text-white shadow-lg"
                  : "border-white/10 bg-white/[0.03] text-mist-400 hover:bg-white/[0.07] hover:text-white"
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>

        {tab === "profile" && <ProfileSection portfolio={portfolio} />}

        {tab === "slides" && (
          <CollectionSection
            table="slides"
            portfolioId={portfolio.id}
            items={slides}
            heading="الصور المميزة"
            description="الشرائح التي تتبدّل في أعلى صفحتك. أضف صورة لكل شريحة مع عنوان قصير."
            addLabel="إضافة شريحة"
            emptyLabel="لا توجد شرائح بعد."
            confirmText="حذف هذه الشريحة؟"
            itemTitle={(item) => item.headline || "شريحة بدون عنوان"}
            renderFields={(slide) => (
              <>
                <ImageField name="image" current={slide.image_url} label="صورة الشريحة" aspect={16 / 9} hint="أفضل مقاس 1400×790 بكسل." />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="العنوان">
                    <input name="headline" defaultValue={slide.headline} className="field" />
                  </Field>
                  <Field label="السطر الفرعي">
                    <input name="subline" defaultValue={slide.subline} className="field" />
                  </Field>
                </div>
              </>
            )}
          />
        )}

        {tab === "projects" && (
          <CollectionSection
            table="projects"
            portfolioId={portfolio.id}
            items={projects}
            heading="الأعمال"
            description="معرض أعمالك. كل عمل يظهر كبطاقة مربعة يمكن ربطها بصفحة خارجية."
            addLabel="إضافة عمل"
            emptyLabel="لم تضف أي عمل بعد."
            confirmText="حذف هذا العمل؟"
            itemTitle={(item) => item.title || "عمل بدون عنوان"}
            renderFields={(project) => (
              <>
                <ImageField name="image" current={project.image_url} label="صورة العمل" aspect={1} />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="اسم العمل">
                    <input name="title" defaultValue={project.title} className="field" />
                  </Field>
                  <Field label="التصنيف">
                    <input name="category" defaultValue={project.category} className="field" placeholder="هوية بصرية" />
                  </Field>
                </div>
                <Field label="وصف مختصر">
                  <textarea name="description" defaultValue={project.description} rows={3} className="field" />
                </Field>
                <Field label="رابط خارجي" hint="اختياري — صفحة المشروع على بيهانس أو موقعك.">
                  <input name="link" defaultValue={project.link} className="field" dir="ltr" placeholder="https://" />
                </Field>
              </>
            )}
          />
        )}

        {tab === "stats" && (
          <CollectionSection
            table="stats"
            portfolioId={portfolio.id}
            items={stats}
            heading="الإحصائيات"
            description="تظهر أول ثلاثة عناصر في شريط الأرقام أعلى الصفحة."
            addLabel="إضافة إحصائية"
            emptyLabel="لا توجد إحصائيات بعد."
            confirmText="حذف هذه الإحصائية؟"
            itemTitle={(item) => item.label || "إحصائية"}
            renderFields={(stat) => (
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="العنوان">
                  <input name="label" defaultValue={stat.label} className="field" placeholder="الأعمال" />
                </Field>
                <Field label="القيمة">
                  <input name="value" defaultValue={stat.value} className="field" placeholder="+300" />
                </Field>
                <Field label="الأيقونة">
                  <select name="icon" defaultValue={stat.icon} className="field">
                    {STAT_ICON_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
            )}
          />
        )}

        {tab === "socials" && (
          <CollectionSection
            table="socials"
            portfolioId={portfolio.id}
            items={socials}
            heading="روابط التواصل"
            description="تظهر أول خمسة روابط كأيقونات في أعلى صفحتك."
            addLabel="إضافة رابط"
            emptyLabel="لم تضف أي رابط بعد."
            confirmText="حذف هذا الرابط؟"
            itemTitle={(item) =>
              SOCIAL_META[item.platform as SocialPlatform]?.label ?? "رابط"
            }
            renderFields={(social) => (
              <div className="grid gap-4 sm:grid-cols-[180px_1fr]">
                <Field label="المنصة">
                  <select name="platform" defaultValue={social.platform} className="field">
                    {(Object.keys(SOCIAL_META) as SocialPlatform[]).map((key) => (
                      <option key={key} value={key}>
                        {SOCIAL_META[key].label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="الرابط">
                  <input name="url" defaultValue={social.url} className="field" dir="ltr" placeholder="https://instagram.com/username" />
                </Field>
              </div>
            )}
          />
        )}

        {tab === "settings" && (
          <SettingsSection
            portfolio={portfolio}
            user={user}
            origin={origin}
            hasPassword={hasPassword}
            canPublish={canPublish}
          />
        )}
      </div>

      {/* Live phone preview — desktop only, refreshes whenever an edit revalidates. */}
      <aside className="hidden xl:sticky xl:top-24 xl:block">
        <p className="mb-3 text-center text-[12.5px] text-mist-500">معاينة مباشرة</p>
        <div className="mx-auto w-[380px] overflow-hidden rounded-[42px] border border-white/12 bg-ink-950 p-2 shadow-[0_40px_90px_-40px_rgba(0,0,0,1)]">
          <div className="no-scrollbar h-[720px] overflow-y-auto rounded-[34px] bg-ink-950">
            {preview}
          </div>
        </div>
      </aside>
    </div>
  );
}
