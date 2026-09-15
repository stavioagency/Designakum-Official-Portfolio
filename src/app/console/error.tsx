"use client";

import { useEffect } from "react";
import { AlertTriangle } from "@/components/icons";

export default function ConsoleError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("console error:", error);
  }, [error]);

  return (
    <div className="card grid place-items-center p-10 text-center">
      <span className="mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-rose-500/12 text-rose-300">
        <AlertTriangle className="h-6 w-6" />
      </span>
      <h1 className="text-lg font-semibold">تعذّر عرض هذه الصفحة</h1>
      <p className="mx-auto mt-2 max-w-sm text-[13px] leading-relaxed text-mist-400">
        حدث خطأ غير متوقع أثناء تحميل البيانات. جرّب مرة أخرى، وإن تكرر الأمر راجع سجل الخادم.
      </p>
      {error.digest && (
        <code dir="ltr" className="mt-3 text-[11px] text-mist-600">
          {error.digest}
        </code>
      )}
      <button onClick={reset} className="btn btn-primary mt-6">
        إعادة المحاولة
      </button>
    </div>
  );
}
