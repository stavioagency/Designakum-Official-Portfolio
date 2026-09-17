"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Globe } from "@/components/icons";

/**
 * The product, in the first screen, as the thing you do.
 *
 * The page said the word "link" three times before showing one. Here the
 * address is the call to action: somebody types the name they want and is
 * carried to sign-up with it, so the first thing they do on the site is the
 * thing the site is for.
 *
 * It deliberately does not say whether the name is free. Availability is
 * answered by `/api/portfolio/slug`, which requires a session on purpose —
 * answering it for anyone would let a stranger enumerate which customers exist
 * by typing names at this box. The name is carried through sign-up and checked
 * on /welcome, where there is an account behind the question.
 */
export function ClaimLink({
  host,
  d,
}: {
  /** The address as a reader sees it, with no scheme. */
  host: string;
  d: {
    claimLabel: string;
    claimPlaceholder: string;
    claimCta: string;
    claimHint: string;
    claimDomain: string;
  };
}) {
  const router = useRouter();
  const [slug, setSlug] = useState("");

  // Typed straight into the shape a link has to take, rather than rejected
  // afterwards: spaces become dashes, and anything a URL cannot carry is simply
  // never accepted into the field.
  const clean = (value: string) =>
    value
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "")
      .replace(/-{2,}/g, "-")
      .slice(0, 40);

  /**
   * Shown only when something a person typed was actually dropped.
   *
   * There used to be a permanent line reading "Latin letters, numbers and
   * dashes", which is a rule nobody can break: the field never accepts anything
   * else, so the note taught nothing and sat under the main call to action
   * looking like an error. The one case where it is worth saying is when an
   * Arabic speaker types their name in Arabic and nothing appears.
   */
  const [dropped, setDropped] = useState(false);

  const go = (event: React.FormEvent) => {
    event.preventDefault();
    const name = slug.replace(/^-+|-+$/g, "");
    router.push(name ? `/signup?slug=${encodeURIComponent(name)}` : "/signup");
  };

  return (
    <form onSubmit={go} className="mt-8">
      <label htmlFor="claim" className="label !mb-2.5 text-mist-400">
        {d.claimLabel}
      </label>

      <div className="flex flex-col gap-2.5 sm:flex-row">
        {/* One field that reads as an address: the host is part of the control,
            not a caption above it. */}
        <div className="claim-field flex min-w-0 flex-1 items-center gap-0 ltr" dir="ltr">
          <span className="shrink-0 ps-4 text-[14px] text-mist-500">{host}/</span>
          <input
            id="claim"
            name="slug"
            value={slug}
            onChange={(event) => {
              const typed = event.target.value;
              const kept = clean(typed);
              setDropped(typed.trim().length > 0 && kept.length < typed.trim().length);
              setSlug(kept);
            }}
            placeholder={d.claimPlaceholder}
            autoComplete="off"
            spellCheck={false}
            className="min-w-0 flex-1 bg-transparent py-3.5 pe-4 ps-0 text-[15px] font-semibold outline-none placeholder:font-normal placeholder:text-mist-600"
          />
        </div>

        <button type="submit" className="btn btn-primary shrink-0 !py-3.5">
          {d.claimCta}
        </button>
      </div>

      {dropped && (
        <p className="mt-2.5 text-[12px] text-amber-300/90">{d.claimHint}</p>
      )}

      {/* Said here rather than only in the plan's feature list: somebody who
          already owns a domain is deciding right now whether this address is
          the one they are stuck with. */}
      <p className="mt-2.5 flex items-start justify-center gap-1.5 text-[12px] leading-relaxed text-mist-400 lg:justify-start">
        <Globe
          className="mt-[3px] h-3.5 w-3.5 shrink-0"
          style={{ color: "var(--accent-ring)" }}
        />
        <span dir="auto">{d.claimDomain}</span>
      </p>
    </form>
  );
}
