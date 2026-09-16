"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import type { FormState } from "@/app/actions/auth";
import type { Dictionary } from "@/lib/i18n";
import { Check, Globe, X } from "@/components/icons";

type Availability = "idle" | "checking" | "available" | "taken" | "invalid";

function Submit({
  label,
  pending: pendingLabel,
  blocked,
}: {
  label: string;
  pending: string;
  /** A link we already know is unusable — let them fix it here, not after a round trip. */
  blocked: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn-primary w-full" disabled={pending || blocked}>
      {pending ? pendingLabel : label}
    </button>
  );
}

export function WelcomeForm({
  action,
  d,
  origin,
  suggestion,
}: {
  action: (prev: FormState, fd: FormData) => Promise<FormState>;
  d: Dictionary["welcome"];
  /** Shown beside the field so the link reads as a real address, not a form value. */
  origin: string;
  suggestion: string;
}) {
  const [state, formAction] = useActionState(action, null);
  const [slug, setSlug] = useState(suggestion);
  const [availability, setAvailability] = useState<Availability>("idle");

  useEffect(() => {
    const candidate = slug.trim();
    if (!candidate) {
      setAvailability("invalid");
      return;
    }

    setAvailability("checking");
    // Debounced, and cancelled on the next keystroke, so typing a ten-character
    // link asks once rather than ten times.
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/portfolio/slug?slug=${encodeURIComponent(candidate)}`, {
          signal: controller.signal,
        });
        const body = (await response.json()) as { status: Availability };
        setAvailability(body.status);
      } catch {
        // An aborted or failed check leaves the field neutral; the server action
        // is still the thing that decides, so nothing is lost by staying quiet.
        if (!controller.signal.aborted) setAvailability("idle");
      }
    }, 350);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [slug]);

  const hint = {
    idle: null,
    checking: { text: d.checking, tone: "text-mist-500", Icon: null },
    available: { text: d.available, tone: "text-emerald-300", Icon: Check },
    taken: { text: d.taken, tone: "text-rose-300", Icon: X },
    invalid: { text: d.invalid, tone: "text-rose-300", Icon: X },
  }[availability];

  return (
    <form action={formAction} className="space-y-6">
      <div>
        <label className="label" htmlFor="slug">{d.slugLabel}</label>
        <div className="field flex items-center gap-1 !py-2" dir="ltr">
          <Globe className="h-4 w-4 shrink-0 text-mist-500" />
          <span className="shrink-0 text-[13px] text-mist-500">{origin}/p/</span>
          <input
            id="slug"
            name="slug"
            dir="ltr"
            required
            autoComplete="off"
            spellCheck={false}
            value={slug}
            onChange={(event) => setSlug(event.target.value)}
            className="min-w-0 flex-1 bg-transparent text-[14px] font-semibold text-mist-50 outline-none"
          />
        </div>
        <p className={`mt-2 flex h-4 items-center gap-1.5 text-[12px] ${hint?.tone ?? ""}`}>
          {hint?.Icon && <hint.Icon className="h-3.5 w-3.5" />}
          {hint?.text}
        </p>
      </div>

      <div>
        <div className="flex items-baseline justify-between gap-2">
          <label className="label" htmlFor="title">{d.titleLabel}</label>
          <span className="mb-[7px] text-[11.5px] text-mist-500">{d.titleOptional}</span>
        </div>
        <input id="title" name="title" className="field" placeholder={d.titlePlaceholder} />
      </div>

      {state?.error && (
        <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-[13px] text-rose-200">
          {state.error}
        </p>
      )}

      <Submit
        label={d.submit}
        pending={d.pending}
        blocked={availability === "taken" || availability === "invalid"}
      />
    </form>
  );
}
