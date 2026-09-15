"use client";

import { useActionState } from "react";
import { publishAction } from "@/app/actions/portfolio";
import type { Portfolio } from "@/lib/types";
import { Status, Submit } from "./ui";

export function PublishBar({ portfolio }: { portfolio: Portfolio }) {
  const [state, publish] = useActionState(publishAction, null);
  const isPublished = portfolio.published === 1;

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
