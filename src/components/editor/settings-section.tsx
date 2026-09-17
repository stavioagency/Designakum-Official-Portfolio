"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { publishAction, saveSlugAction } from "@/app/actions/portfolio";
import { changePasswordAction } from "@/app/actions/auth";
import { setBrandingAction } from "@/app/actions/portfolio";
import { EmailChange } from "@/components/account/email-change";
import { Check, Link as LinkIcon } from "@/components/icons";
import type { Portfolio, User } from "@/lib/types";
import type { Dictionary } from "@/lib/i18n";
import { Field, Status, Submit } from "./ui";
import { PasswordField } from "@/components/password-field";

export function SettingsSection({
  portfolio,
  user,
  origin,
  hasPassword,
  canPublish,
  copy,
  passwordCopy,
}: {
  portfolio: Portfolio;
  user: User;
  origin: string;
  /** Google-only accounts are offered "set a password" instead of "change". */
  hasPassword: boolean;
  /** The subscription gates publishing and nothing else. */
  canPublish: boolean;
  copy: Dictionary["dashboard"];
  passwordCopy: Dictionary["password"];
}) {
  const t = copy.settings;
  const planLabel: Record<string, string> = {
    free: t.planFree,
    monthly: t.planMonthly,
    yearly: t.planYearly,
  };
  const [slugState, saveSlug] = useActionState(saveSlugAction, null);
  const [passwordState, changePassword] = useActionState(changePasswordAction, null);
  const [publishState, publish] = useActionState(publishAction, null);
  const [brandingState, setBranding] = useActionState(setBrandingAction, null);
  const [copied, setCopied] = useState(false);

  const publicUrl = `${origin}/p/${portfolio.slug}`;
  const isPublished = portfolio.published === 1;

  return (
    <div className="space-y-4">
      <section className="card space-y-4 p-5 sm:p-6">
        <header>
          <h2 className="text-lg font-semibold">{t.linkHeading}</h2>
          <p className="mt-1 text-[13px] text-mist-400">{t.linkDescription}</p>
        </header>

        <div className="panel flex flex-wrap items-center justify-between gap-3 p-3.5">
          <code dir="ltr" className="truncate text-[13px] text-mist-300">
            {publicUrl}
          </code>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(publicUrl);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                } catch {
                  /* clipboard blocked — the text is on screen to copy manually */
                }
              }}
              className="btn btn-ghost !px-3.5 !py-2 text-[13px]"
            >
              {copied ? <Check className="h-4 w-4" /> : <LinkIcon className="h-4 w-4" />}
              {copied ? copy.common.copied : copy.common.copy}
            </button>
            <Link
              href={`/p/${portfolio.slug}`}
              target="_blank"
              className="btn btn-ghost !px-3.5 !py-2 text-[13px]"
            >
              {copy.common.open}
            </Link>
          </div>
        </div>

        <form action={saveSlug} className="space-y-3">
          <input type="hidden" name="portfolioId" value={portfolio.id} />
          <Field label={t.changeSlug} hint={t.changeSlugHint}>
            <div className="flex items-center gap-2">
              <span className="shrink-0 text-sm text-mist-500" dir="ltr">/p/</span>
              <input name="slug" defaultValue={portfolio.slug} className="field" dir="ltr" />
            </div>
          </Field>
          <div className="flex flex-wrap items-center gap-3">
            <Submit className="btn btn-ghost" pendingLabel={copy.common.saving}>
              {t.saveSlug}
            </Submit>
            <Status state={slugState} />
          </div>
        </form>
      </section>

      <section className="card space-y-4 p-5 sm:p-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">{t.publishHeading}</h2>
            <p className="mt-1 text-[13px] leading-relaxed text-mist-400">
              {!canPublish
                ? t.publishLocked
                : isPublished
                  ? t.publishLive
                  : t.publishDraft}
            </p>
          </div>
          <span
            className={`rounded-full px-3 py-1.5 text-[12px] font-semibold ${
              isPublished && canPublish
                ? "bg-emerald-400/12 text-emerald-300"
                : "bg-amber-400/12 text-amber-300"
            }`}
          >
            {!canPublish ? t.badgeNeedsPlan : isPublished ? t.badgePublished : t.badgeDraft}
          </span>
        </header>

        {!canPublish ? (
          <Link href="/dashboard/billing" className="btn btn-primary">
            {t.subscribeCta}
          </Link>
        ) : (
        <form action={publish} className="flex flex-wrap items-center gap-3">
          <input type="hidden" name="portfolioId" value={portfolio.id} />
          <input type="hidden" name="value" value={isPublished ? "0" : "1"} />
          <Submit
            className={isPublished ? "btn btn-ghost" : "btn btn-primary"}
            pendingLabel={copy.common.pending}
          >
            {isPublished ? t.unpublish : t.publish}
          </Submit>
          <Status state={publishState} />
        </form>
        )}
      </section>

      <section className="card space-y-3 p-5 sm:p-6">
        <h2 className="text-lg font-semibold">{t.accountHeading}</h2>
        <dl className="grid gap-3 text-[13.5px] sm:grid-cols-3">
          <div className="panel p-3.5">
            <dt className="text-[12px] text-mist-500">{t.email}</dt>
            <dd dir="ltr" className="mt-1 truncate text-mist-200">{user.email}</dd>
          </div>
          <div className="panel p-3.5">
            <dt className="text-[12px] text-mist-500">{t.plan}</dt>
            <dd className="mt-1 text-mist-200">{planLabel[user.plan] ?? user.plan}</dd>
          </div>
          <div className="panel p-3.5">
            <dt className="text-[12px] text-mist-500">{t.views}</dt>
            <dd className="tnum mt-1 text-mist-200">{portfolio.views}</dd>
          </div>
        </dl>
        <p className="text-[12px] leading-relaxed text-mist-500">
          {t.accountNote}
        </p>
      </section>

      {/*
        Only shown to a customer who can actually have it. The server checks the
        same entitlement again — this is what they see, not what enforces it.
      */}
      {canPublish && (
        <section className="card space-y-4 p-5 sm:p-6">
          <header>
            <h2 className="text-lg font-semibold">{t.branding}</h2>
            <p className="mt-1 text-[13px] leading-relaxed text-mist-400">{t.brandingNote}</p>
          </header>

          <form action={setBranding} className="flex flex-wrap items-center gap-3">
            <input type="hidden" name="portfolioId" value={portfolio.id} />
            <input type="hidden" name="hide" value={portfolio.hide_branding === 1 ? "0" : "1"} />
            <Submit pendingLabel={copy.common.saving}>
              {portfolio.hide_branding === 1 ? t.brandingShow : t.brandingHide}
            </Submit>
            <span className="text-[12.5px] text-mist-500">
              {portfolio.hide_branding === 1 ? t.brandingIsHidden : t.brandingIsShown}
            </span>
            <Status state={brandingState} />
          </form>
        </section>
      )}

      <EmailChange
        currentEmail={user.email}
        hasPassword={hasPassword}
        usesGoogle={Boolean(user.google_id)}
        t={t}
        saving={copy.common.saving}
      />

      <section className="card space-y-4 p-5 sm:p-6">
        <header>
          <h2 className="text-lg font-semibold">
            {hasPassword ? t.changePassword : t.setPassword}
          </h2>
          <p className="mt-1 text-[13px] leading-relaxed text-mist-400">
            {hasPassword
              ? t.changePasswordNote
              : t.setPasswordNote}
          </p>
        </header>

        <form action={changePassword} className="space-y-4">
          {hasPassword && (
            <Field label={t.currentPassword}>
              <input
                name="current"
                type="password"
                className="field"
                dir="ltr"
                required
                autoComplete="current-password"
              />
            </Field>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <PasswordField name="next" label={t.newPassword} copy={passwordCopy} />
            <Field label={t.confirmPassword}>
              <input
                name="confirm"
                type="password"
                className="field"
                dir="ltr"
                minLength={8}
                required
                autoComplete="new-password"
              />
            </Field>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Submit pendingLabel={copy.common.saving}>
              {hasPassword ? t.changePassword : t.setPassword}
            </Submit>
            <Status state={passwordState} />
          </div>
        </form>
      </section>
    </div>
  );
}
