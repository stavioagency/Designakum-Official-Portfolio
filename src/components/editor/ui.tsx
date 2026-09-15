"use client";

import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { Check, Plus, Trash } from "@/components/icons";
import type { ActionState } from "@/app/actions/portfolio";

export function Submit({
  children,
  className = "btn btn-primary",
  pendingLabel = "جارٍ الحفظ…",
  ...rest
}: {
  children: React.ReactNode;
  className?: string;
  pendingLabel?: string;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending} {...rest}>
      {pending ? pendingLabel : children}
    </button>
  );
}

export function IconSubmit({
  children,
  title,
  className = "",
}: {
  children: React.ReactNode;
  title: string;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      title={title}
      aria-label={title}
      disabled={pending}
      className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/5 text-mist-300 transition hover:bg-white/10 hover:text-white disabled:opacity-40 ${className}`}
    >
      {children}
    </button>
  );
}

/**
 * Shows an action's result. Confirmations fade out on their own; errors stay put
 * until the next attempt, since the reader needs time to act on them.
 */
export function Status({ state }: { state: ActionState }) {
  const [visible, setVisible] = useState(false);
  const stamp = useRef(0);

  useEffect(() => {
    if (!state) return;
    setVisible(true);
    if (state.error) return;

    stamp.current += 1;
    const mine = stamp.current;
    const id = setTimeout(() => {
      if (stamp.current === mine) setVisible(false);
    }, 4000);
    return () => clearTimeout(id);
  }, [state]);

  if (!state || !visible) return null;

  return state.error ? (
    <p
      role="alert"
      className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3.5 py-2 text-[12.5px] leading-relaxed text-rose-200"
    >
      {state.error}
    </p>
  ) : (
    <p className="flex items-center gap-1.5 rounded-xl border border-emerald-400/25 bg-emerald-400/10 px-3.5 py-2 text-[12.5px] text-emerald-200">
      <Check className="h-4 w-4" />
      {state.ok}
    </p>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <span className="label">{label}</span>
      {children}
      {hint && <p className="mt-1.5 text-[11.5px] leading-relaxed text-mist-500">{hint}</p>}
    </div>
  );
}

export function AddButton({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-white/15 bg-white/[0.02] px-4 py-4 text-[14px] font-medium text-mist-300 transition hover:border-white/30 hover:bg-white/5 hover:text-white disabled:opacity-50"
    >
      <Plus className="h-4.5 w-4.5" />
      {pending ? "جارٍ الإضافة…" : children}
    </button>
  );
}

export function DeleteSubmit({ confirmText }: { confirmText: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      title="حذف"
      aria-label="حذف"
      disabled={pending}
      onClick={(e) => {
        if (!confirm(confirmText)) e.preventDefault();
      }}
      className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-rose-500/25 bg-rose-500/10 text-rose-300 transition hover:bg-rose-500/20 disabled:opacity-40"
    >
      <Trash className="h-4 w-4" />
    </button>
  );
}
