"use client";

import { useState } from "react";
import { CollectionSection } from "./collection-section";
import { ProfileSection } from "./profile-section";
import { SettingsSection } from "./settings-section";
import { Field } from "./ui";
import { ImageField } from "./image-field";
import { SOCIAL_META, STAT_ICON_OPTIONS } from "@/components/icons";
import type { Dictionary } from "@/lib/i18n";
import type { PortfolioBundle, SocialPlatform, User } from "@/lib/types";

const TAB_KEYS = ["profile", "slides", "projects", "stats", "socials", "settings"] as const;

type TabKey = (typeof TAB_KEYS)[number];

export function Editor({
  bundle,
  user,
  origin,
  preview,
  hasPassword,
  canPublish,
  copy,
}: {
  bundle: PortfolioBundle;
  user: User;
  origin: string;
  preview: React.ReactNode;
  hasPassword: boolean;
  canPublish: boolean;
  copy: Dictionary["dashboard"];
}) {
  const [tab, setTab] = useState<TabKey>("profile");
  const { portfolio, slides, projects, stats, socials } = bundle;

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_400px] xl:items-start">
      <div className="min-w-0 space-y-5">
        <nav className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {TAB_KEYS.map((key) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`shrink-0 rounded-2xl border px-4 py-2.5 text-[13.5px] font-medium transition ${
                tab === key
                  ? "accent-grad border-transparent text-white shadow-lg"
                  : "border-white/10 bg-white/[0.03] text-mist-400 hover:bg-white/[0.07] hover:text-white"
              }`}
            >
              {copy.tabs[key]}
            </button>
          ))}
        </nav>

        {tab === "profile" && <ProfileSection portfolio={portfolio} copy={copy} />}

        {tab === "slides" && (
          <CollectionSection
            table="slides"
            portfolioId={portfolio.id}
            items={slides}
            heading={copy.slides.heading}
            description={copy.slides.description}
            addLabel={copy.slides.add}
            emptyLabel={copy.slides.empty}
            confirmText={copy.slides.confirm}
            itemTitle={(item) => item.headline || copy.slides.untitled}
            renderFields={(slide) => (
              <>
                <ImageField
                  name="image"
                  current={slide.image_url}
                  label={copy.slides.image}
                  aspect={16 / 9}
                  hint={copy.slides.imageHint}
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label={copy.slides.headline}>
                    <input name="headline" defaultValue={slide.headline} className="field" />
                  </Field>
                  <Field label={copy.slides.subline}>
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
            heading={copy.projects.heading}
            description={copy.projects.description}
            addLabel={copy.projects.add}
            emptyLabel={copy.projects.empty}
            confirmText={copy.projects.confirm}
            itemTitle={(item) => item.title || copy.projects.untitled}
            renderFields={(project) => (
              <>
                <ImageField name="image" current={project.image_url} label={copy.projects.image} aspect={1} />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label={copy.projects.name}>
                    <input name="title" defaultValue={project.title} className="field" />
                  </Field>
                  <Field label={copy.projects.category}>
                    <input
                      name="category"
                      defaultValue={project.category}
                      className="field"
                      placeholder={copy.projects.categoryPlaceholder}
                    />
                  </Field>
                </div>
                <Field label={copy.projects.blurb}>
                  <textarea name="description" defaultValue={project.description} rows={3} className="field" />
                </Field>
                <Field label={copy.projects.link} hint={copy.projects.linkHint}>
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
            heading={copy.stats.heading}
            description={copy.stats.description}
            addLabel={copy.stats.add}
            emptyLabel={copy.stats.empty}
            confirmText={copy.stats.confirm}
            itemTitle={(item) => item.label || copy.stats.untitled}
            renderFields={(stat) => (
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label={copy.stats.label}>
                  <input
                    name="label"
                    defaultValue={stat.label}
                    className="field"
                    placeholder={copy.stats.labelPlaceholder}
                  />
                </Field>
                <Field label={copy.stats.value}>
                  <input name="value" defaultValue={stat.value} className="field" placeholder="+300" />
                </Field>
                <Field label={copy.stats.icon}>
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
            heading={copy.socials.heading}
            description={copy.socials.description}
            addLabel={copy.socials.add}
            emptyLabel={copy.socials.empty}
            confirmText={copy.socials.confirm}
            itemTitle={(item) =>
              SOCIAL_META[item.platform as SocialPlatform]?.label ?? copy.socials.untitled
            }
            renderFields={(social) => (
              <div className="grid gap-4 sm:grid-cols-[180px_1fr]">
                <Field label={copy.socials.platform}>
                  <select name="platform" defaultValue={social.platform} className="field">
                    {(Object.keys(SOCIAL_META) as SocialPlatform[]).map((key) => (
                      <option key={key} value={key}>
                        {SOCIAL_META[key].label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label={copy.socials.url}>
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
            copy={copy}
          />
        )}
      </div>

      {/* Live phone preview — desktop only, refreshes whenever an edit revalidates. */}
      <aside className="hidden xl:sticky xl:top-24 xl:block">
        <p className="mb-3 text-center text-[12.5px] text-mist-500">{copy.profile.livePreview}</p>
        <div className="mx-auto w-[380px] overflow-hidden rounded-[42px] border border-white/12 bg-ink-950 p-2 shadow-[0_40px_90px_-40px_rgba(0,0,0,1)]">
          <div className="no-scrollbar h-[720px] overflow-y-auto rounded-[34px] bg-ink-950">
            {preview}
          </div>
        </div>
      </aside>
    </div>
  );
}
