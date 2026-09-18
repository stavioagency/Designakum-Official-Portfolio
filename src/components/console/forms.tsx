"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { AlertTriangle, Search, X } from "@/components/icons";
import { Modal } from "@/components/ui/modal";

/* ----------------------------------------------------------------- filters */

/** Debounced search that writes straight into the URL, so results stay linkable. */
export function SearchField({
  placeholder = "بحث…",
  clearLabel = "مسح البحث",
  paramName = "q",
}: {
  placeholder?: string;
  clearLabel?: string;
  paramName?: string;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [value, setValue] = useState(params.get(paramName) ?? "");
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const id = setTimeout(() => {
      const next = new URLSearchParams(params.toString());
      if (value) next.set(paramName, value);
      else next.delete(paramName);
      next.delete("page");
      router.replace(`?${next.toString()}`, { scroll: false });
    }, 300);
    return () => clearTimeout(id);
    // `params` changes on every navigation; keying off the typed value is the intent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    /* Its own line on a phone: beside a filter it had about 150px, which is
       not enough for a search box to show what was typed into it. */
    <div className="relative w-full min-w-0 flex-1 sm:w-auto sm:min-w-[200px]">
      <Search className="pointer-events-none absolute inset-y-0 my-auto h-4 w-4 text-mist-500 start-3.5" />
      <input
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={placeholder}
        className="field !ps-10"
        type="search"
      />
      {value && (
        <button
          type="button"
          onClick={() => setValue("")}
          aria-label={clearLabel}
          className="absolute inset-y-0 my-auto grid h-6 w-6 place-items-center rounded-lg text-mist-500 transition hover:text-white end-3"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

export function FilterSelect({
  paramName,
  options,
  label,
}: {
  paramName: string;
  options: { value: string; label: string }[];
  label: string;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const current = params.get(paramName) ?? options[0]?.value ?? "";

  return (
    /* A select is as wide as its longest option unless it is told otherwise,
       and an option here can be `account.two_factor_enabled`. Left alone it
       runs off the side of a phone. */
    <label className="flex w-full min-w-0 items-center gap-2 sm:w-auto">
      <span className="shrink-0 text-[12px] text-mist-500">{label}</span>
      <select
        value={current}
        onChange={(event) => {
          const next = new URLSearchParams(params.toString());
          if (event.target.value && event.target.value !== options[0]?.value) {
            next.set(paramName, event.target.value);
          } else {
            next.delete(paramName);
          }
          next.delete("page");
          router.replace(`?${next.toString()}`, { scroll: false });
        }}
        className="field min-w-0 !py-2 text-[13px] sm:!w-auto"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

/* ------------------------------------------------------------ confirmation */

/**
 * Destructive submits open a modal first. The dialog owns a copy of the form's
 * fields, so the action still receives exactly what the form declared while the
 * operator gets a clear statement of what is about to happen.
 */
export function ConfirmSubmit({
  label,
  title,
  body,
  confirmLabel,
  className = "btn btn-danger",
  requireText,
  icon,
  cancelLabel = "إلغاء",
  pendingLabel = "لحظة…",
  /** Split around the word to type, e.g. ["Type ", " to confirm"]. */
  confirmParts = ["اكتب ", " للتأكيد"],
}: {
  label: React.ReactNode;
  title: string;
  body: string;
  confirmLabel: string;
  className?: string;
  /** When set, the operator must type this exact string to enable the button. */
  requireText?: string;
  icon?: React.ReactNode;
  cancelLabel?: string;
  pendingLabel?: string;
  confirmParts?: [string, string];
}) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [formId, setFormId] = useState<string>();
  const [typed, setTyped] = useState("");
  const { pending } = useFormStatus();
  const blocked = Boolean(requireText) && typed !== requireText;

  // The dialog closes itself once the action is in flight.
  useEffect(() => {
    if (pending) setOpen(false);
  }, [pending]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => {
          // The confirm button lives outside the form once portalled, so the form
          // needs an id for that button's `form` attribute to point at.
          const form = triggerRef.current?.closest("form");
          if (form) {
            if (!form.id) form.id = `confirm-${Math.random().toString(36).slice(2, 10)}`;
            setFormId(form.id);
          }
          setTyped("");
          setOpen(true);
        }}
        disabled={pending}
        className={className}
      >
        {icon}
        {pending ? pendingLabel : label}
      </button>

      {open && (
        <Modal onClose={() => setOpen(false)}>
          <div className="card w-full max-w-md p-6">
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-rose-500/12 text-rose-300">
                <AlertTriangle className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <h3 className="text-[16px] font-semibold">{title}</h3>
                <p className="mt-1.5 text-[13px] leading-relaxed text-mist-400">{body}</p>
              </div>
            </div>

            {requireText && (
              <label className="mt-4 block">
                <span className="label">
                  {confirmParts[0]}
                  <code dir="ltr" className="text-mist-300">{requireText}</code>
                  {confirmParts[1]}
                </span>
                <input
                  autoFocus
                  value={typed}
                  onChange={(event) => setTyped(event.target.value)}
                  className="field"
                  dir="ltr"
                  autoComplete="off"
                />
              </label>
            )}

            <div className="mt-6 flex items-center justify-end gap-2">
              <button type="button" onClick={() => setOpen(false)} className="btn btn-ghost">
                {cancelLabel}
              </button>
              <button type="submit" form={formId} disabled={blocked} className="btn btn-danger">
                {confirmLabel}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}

/** Submits the enclosing form as soon as the control changes. */
export function AutoSubmitSelect({
  name,
  defaultValue,
  options,
  ariaLabel,
  className = "field !w-auto !py-2 text-[13px] sm:text-[13px]",
}: {
  name: string;
  defaultValue: string;
  options: { value: string; label: string }[];
  ariaLabel: string;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <select
      name={name}
      defaultValue={defaultValue}
      aria-label={ariaLabel}
      disabled={pending}
      onChange={(event) => event.currentTarget.form?.requestSubmit()}
      className={className}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
