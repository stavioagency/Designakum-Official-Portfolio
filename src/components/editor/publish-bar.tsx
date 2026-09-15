"use client";

import Link from "next/link";
import { useActionState } from "react";
import { publishAction } from "@/app/actions/portfolio";
import type { Portfolio } from "@/lib/types";
import type { Dictionary } from "@/lib/i18n";
import { Status, Submit } from "./ui";

export function PublishBar({
  portfolio,
  canPublish,
  copy,
}: {
  portfolio: Portfolio;
  canPublish: boolean;
  copy: Dictionary["dashboard"];
}) {
  const t = copy.publishBar;
  const [state, publish] = useActionState(publishAction, null);
  const isPublished = portfolio.published === 1;

  if (!canPublish) {
    return (
      <div className="card flex flex-wrap items-center justify-between gap-4 p-4 sm:p-5">
        <div className="flex items-center gap-3">
          <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
          <p className="text-[13.5px] leading-relaxed text-mist-300">
            {t.locked}
          </p>
        </div>
        <Link href="/dashboard/billing" className="btn btn-primary">
          {t.subscribeCta}
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
            ? t.live
            : t.draft}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Status state={state} />
        <Submit
          className={isPublished ? "btn btn-ghost" : "btn btn-primary"}
          pendingLabel={copy.common.pending}
        >
          {isPublished ? t.hide : t.publish}
        </Submit>
      </div>
    </form>
  );
}
