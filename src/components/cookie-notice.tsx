"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const STORAGE_KEY = "dk_cookie_notice";

/**
 * A notice, not a consent gate.
 *
 * The platform sets two cookies, both strictly necessary — the session and the
 * interface language — and runs no advertising trackers. PDPL requires that
 * people are told; it does not require a consent wall for cookies without which
 * the service cannot work, and offering a "reject" button that cannot actually
 * reject anything would be a lie dressed as a choice.
 *
 * The dismissal lives in localStorage rather than a cookie, so reading this
 * notice does not itself create the thing it is describing.
 */
export function CookieNotice({
  body,
  policy,
  dismiss,
}: {
  body: string;
  policy: string;
  dismiss: string;
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) setVisible(true);
    } catch {
      // Private browsing, or storage blocked. Staying quiet is the safer default:
      // a banner that cannot remember being dismissed would return on every page.
    }
  }, []);

  if (!visible) return null;

  const close = () => {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* dismissal is best-effort */
    }
    setVisible(false);
  };

  return (
    <div
      role="region"
      aria-label={policy}
      className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-2xl sm:inset-x-6"
    >
      <div className="card flex flex-col gap-3 p-4 text-[12.5px] leading-relaxed text-mist-300 sm:flex-row sm:items-center sm:gap-4">
        <p className="min-w-0 flex-1">
          {body}{" "}
          <Link href="/legal/privacy" className="underline decoration-white/25 underline-offset-4">
            {policy}
          </Link>
        </p>
        <button type="button" onClick={close} className="btn btn-ghost shrink-0 sm:w-auto">
          {dismiss}
        </button>
      </div>
    </div>
  );
}
