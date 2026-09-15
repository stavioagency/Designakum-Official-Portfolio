"use client";

import Link from "next/link";
import { useActionState } from "react";
import { publishAction } from "@/app/actions/portfolio";
import type { Portfolio } from "@/lib/types";
import { Status, Submit } from "./ui";

export function PublishBar({
  portfolio,
  canPublish,
}: {
  portfolio: Portfolio;
  canPublish: boolean;
}) {
  const [state, publish] = useActionState(publishAction, null);
  const isPublished = portfolio.published === 1;

  if (!canPublish) {
    return (
      <div className="card flex flex-wrap items-center justify-between gap-4 p-4 sm:p-5">
        <div className="flex items-center gap-3">
          <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
          <p className="text-[13.5px] leading-relaxed text-mist-300">
            معرضك جاهز، والنشر هو الخطوة الأخيرة — وهو ما يفتحه الاشتراك.
          </p>
        </div>
        <Link href="/dashboard/billing" className="btn btn-primary">
          فعّل الاشتراك للنشر
        </Link>
      </div>
    );
  }

  return (
    <form action={publish} className="card flex flex-wrap items-center justify-between gap-4 p-4 sm:p-5">
      <input type="hidden" name="portfolioId" value={portfolio.id} />
      <input type="hidden" name="value" value={isPublished ? "0" : "1"} />

      <div className="flex items-center gap-3">
        <span
          className={`h-2.5 w-2.5 rounded-full ${isPublished ? "bg-emerald-400" : "bg-amber-400"}`}
        />
        <p className="text-[13.5px] text-mist-300">
          {isPublished
            ? "الصفحة منشورة ومتاحة لأي شخص لديه الرابط."
            : "الصفحة مسودة — لن يراها أحد حتى تنشرها."}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Status state={state} />
        <Submit className={isPublished ? "btn btn-ghost" : "btn btn-primary"} pendingLabel="لحظة…">
          {isPublished ? "إخفاء" : "نشر الآن"}
        </Submit>
      </div>
    </form>
  );
}
