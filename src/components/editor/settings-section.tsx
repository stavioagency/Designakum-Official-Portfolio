"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { publishAction, saveSlugAction } from "@/app/actions/portfolio";
import { changePasswordAction } from "@/app/actions/auth";
import { Check, Link as LinkIcon } from "@/components/icons";
import type { Portfolio, User } from "@/lib/types";
import { Field, Status, Submit } from "./ui";

const PLAN_LABEL: Record<string, string> = {
  free: "المجانية",
  pro: "الاحترافية",
  business: "الأعمال",
};

export function SettingsSection({
  portfolio,
  user,
  origin,
  hasPassword,
  canPublish,
}: {
  portfolio: Portfolio;
  user: User;
  origin: string;
  /** Google-only accounts are offered "set a password" instead of "change". */
  hasPassword: boolean;
  /** The subscription gates publishing and nothing else. */
  canPublish: boolean;
}) {
  const [slugState, saveSlug] = useActionState(saveSlugAction, null);
  const [passwordState, changePassword] = useActionState(changePasswordAction, null);
  const [publishState, publish] = useActionState(publishAction, null);
  const [copied, setCopied] = useState(false);

  const publicUrl = `${origin}/p/${portfolio.slug}`;
  const isPublished = portfolio.published === 1;

  return (
    <div className="space-y-4">
      <section className="card space-y-4 p-5 sm:p-6">
        <header>
          <h2 className="text-lg font-semibold">الرابط العام</h2>
          <p className="mt-1 text-[13px] text-mist-400">
            هذا هو العنوان الذي تشاركه مع عملائك.
          </p>
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
              {copied ? "تم النسخ" : "نسخ"}
            </button>
            <Link
              href={`/p/${portfolio.slug}`}
              target="_blank"
              className="btn btn-ghost !px-3.5 !py-2 text-[13px]"
            >
              فتح
            </Link>
          </div>
        </div>

        <form action={saveSlug} className="space-y-3">
          <input type="hidden" name="portfolioId" value={portfolio.id} />
          <Field label="تغيير الرابط" hint="حروف إنجليزية وأرقام وشرطات فقط. الروابط القديمة تتوقف عن العمل بعد التغيير.">
            <div className="flex items-center gap-2">
              <span className="shrink-0 text-sm text-mist-500" dir="ltr">/p/</span>
              <input name="slug" defaultValue={portfolio.slug} className="field" dir="ltr" />
            </div>
          </Field>
          <div className="flex flex-wrap items-center gap-3">
            <Submit className="btn btn-ghost">حفظ الرابط</Submit>
            <Status state={slugState} />
          </div>
        </form>
      </section>

      <section className="card space-y-4 p-5 sm:p-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">حالة النشر</h2>
            <p className="mt-1 text-[13px] leading-relaxed text-mist-400">
              {!canPublish
                ? "التعديل والمعاينة مجانيان بالكامل. النشر للعامة هو ما يفتحه الاشتراك."
                : isPublished
                  ? "معرضك ظاهر للجميع عبر الرابط العام."
                  : "معرضك مخفي حاليًا، ولا يراه إلا أنت."}
            </p>
          </div>
          <span
            className={`rounded-full px-3 py-1.5 text-[12px] font-semibold ${
              isPublished && canPublish
                ? "bg-emerald-400/12 text-emerald-300"
                : "bg-amber-400/12 text-amber-300"
            }`}
          >
            {!canPublish ? "يحتاج اشتراكًا" : isPublished ? "منشور" : "مسودة"}
          </span>
        </header>

        {!canPublish ? (
          <Link href="/dashboard/billing" className="btn btn-primary">
            فعّل الاشتراك للنشر
          </Link>
        ) : (
        <form action={publish} className="flex flex-wrap items-center gap-3">
          <input type="hidden" name="portfolioId" value={portfolio.id} />
          <input type="hidden" name="value" value={isPublished ? "0" : "1"} />
          <Submit
            className={isPublished ? "btn btn-ghost" : "btn btn-primary"}
            pendingLabel="لحظة…"
          >
            {isPublished ? "إخفاء المعرض" : "نشر المعرض الآن"}
          </Submit>
          <Status state={publishState} />
        </form>
        )}
      </section>

      <section className="card space-y-3 p-5 sm:p-6">
        <h2 className="text-lg font-semibold">الحساب</h2>
        <dl className="grid gap-3 text-[13.5px] sm:grid-cols-3">
          <div className="panel p-3.5">
            <dt className="text-[12px] text-mist-500">البريد الإلكتروني</dt>
            <dd dir="ltr" className="mt-1 truncate text-mist-200">{user.email}</dd>
          </div>
          <div className="panel p-3.5">
            <dt className="text-[12px] text-mist-500">الباقة</dt>
            <dd className="mt-1 text-mist-200">{PLAN_LABEL[user.plan] ?? user.plan}</dd>
          </div>
          <div className="panel p-3.5">
            <dt className="text-[12px] text-mist-500">مشاهدات الصفحة</dt>
            <dd className="tnum mt-1 text-mist-200">{portfolio.views}</dd>
          </div>
        </dl>
        <p className="text-[12px] leading-relaxed text-mist-500">
          لتغيير الباقة أو النطاق الخاص، تواصل مع إدارة المنصة.
        </p>
      </section>

      <section className="card space-y-4 p-5 sm:p-6">
        <header>
          <h2 className="text-lg font-semibold">
            {hasPassword ? "تغيير كلمة المرور" : "تعيين كلمة مرور"}
          </h2>
          <p className="mt-1 text-[13px] leading-relaxed text-mist-400">
            {hasPassword
              ? "بعد التغيير ستُنهى كل الجلسات الأخرى على الأجهزة الأخرى."
              : "دخلت عبر جوجل. عيّن كلمة مرور لتتمكن من الدخول بالبريد الإلكتروني أيضًا."}
          </p>
        </header>

        <form action={changePassword} className="space-y-4">
          {hasPassword && (
            <Field label="كلمة المرور الحالية">
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
            <Field label="كلمة المرور الجديدة" hint="8 أحرف على الأقل.">
              <input
                name="next"
                type="password"
                className="field"
                dir="ltr"
                minLength={8}
                required
                autoComplete="new-password"
              />
            </Field>
            <Field label="تأكيد كلمة المرور">
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
            <Submit>{hasPassword ? "تغيير كلمة المرور" : "تعيين كلمة المرور"}</Submit>
            <Status state={passwordState} />
          </div>
        </form>
      </section>
    </div>
  );
}
