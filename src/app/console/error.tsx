"use client";

import { useEffect, useState } from "react";
import { AlertTriangle } from "@/components/icons";
import { dict, isLocale } from "@/lib/i18n";

export default function ConsoleError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // An error boundary is a client component and cannot read the locale cookie, but
  // the language it should speak is already stamped on <html> by the root layout.
  const [locale, setLocale] = useState<"ar" | "en">("ar");
  useEffect(() => {
    const lang = document.documentElement.lang;
    if (isLocale(lang)) setLocale(lang);
  }, []);

  const copy = dict(locale).console.common;

  useEffect(() => {
    console.error("console error:", error);
  }, [error]);

  return (
    <div className="card grid place-items-center p-10 text-center">
      <span className="mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-rose-500/12 text-rose-300">
        <AlertTriangle className="h-6 w-6" />
      </span>
      <h1 className="text-lg font-semibold">{copy.errorTitle}</h1>
      <p className="mx-auto mt-2 max-w-sm text-[13px] leading-relaxed text-mist-400">
        {copy.errorBody}
      </p>
      {error.digest && (
        <code dir="ltr" className="mt-3 text-[11px] text-mist-600">
          {error.digest}
        </code>
      )}
      <button onClick={reset} className="btn btn-primary mt-6">
        {copy.retry}
      </button>
    </div>
  );
}
