"use client";

import { useEffect } from "react";

/** Last-resort boundary: the root layout itself failed, so this renders its own document. */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("global error:", error.digest ?? error.message);
  }, [error]);

  return (
    <html lang="ar" dir="rtl">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "grid",
          placeItems: "center",
          background: "#07080e",
          color: "#f6f6fb",
          fontFamily: "system-ui, sans-serif",
          textAlign: "center",
          padding: 24,
        }}
      >
        <div>
          <h1 style={{ fontSize: 22, marginBottom: 10 }}>حدث خطأ غير متوقع</h1>
          <p style={{ fontSize: 14, color: "#8f8fa6", lineHeight: 1.9, maxWidth: 420 }}>
            تعذّر تحميل الصفحة. جرّب إعادة المحاولة، وإن استمر الأمر تواصل مع الدعم.
          </p>
          {error.digest && (
            <code style={{ display: "block", marginTop: 12, fontSize: 11, color: "#6e6e85" }}>
              {error.digest}
            </code>
          )}
          <button
            onClick={reset}
            style={{
              marginTop: 22,
              padding: "12px 20px",
              borderRadius: 14,
              border: "none",
              background: "linear-gradient(135deg, #2563c9, #1b4d9b)",
              color: "#fff",
              fontSize: 15,
              cursor: "pointer",
            }}
          >
            إعادة المحاولة
          </button>
        </div>
      </body>
    </html>
  );
}
