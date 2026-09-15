"use client";

import { useActionState, useState } from "react";
import { saveSettingsAction } from "@/app/actions/settings";
import { Field, Status, Submit } from "@/components/editor/ui";

export type SettingField =
  | { key: string; label: string; hint?: string; type: "text" | "textarea" | "number"; value: string | number }
  | { key: string; label: string; hint?: string; type: "boolean"; value: boolean }
  | { key: string; label: string; hint?: string; type: "money"; value: number };

/** Prices live in halalas; the operator types riyals and this keeps both in sync. */
function MoneyField({
  field,
  riyalLabel,
}: {
  field: Extract<SettingField, { type: "money" }>;
  riyalLabel: string;
}) {
  const [riyals, setRiyals] = useState(String(field.value / 100));
  const halalas = Math.max(0, Math.round(Number(riyals || 0) * 100));

  return (
    <Field label={field.label} hint={field.hint}>
      <div className="flex items-center gap-2">
        <input
          value={riyals}
          onChange={(event) => setRiyals(event.target.value)}
          type="number"
          min={0}
          step="0.01"
          className="field"
          dir="ltr"
        />
        <span className="shrink-0 text-[12.5px] text-mist-500">{riyalLabel}</span>
      </div>
      <input type="hidden" name={field.key} value={halalas} />
    </Field>
  );
}

export function SettingsGroup({
  title,
  description,
  fields,
  columns = 2,
  saveLabel = "حفظ",
  riyalLabel = "ريال",
}: {
  title: string;
  description?: string;
  fields: SettingField[];
  columns?: 1 | 2;
  saveLabel?: string;
  riyalLabel?: string;
}) {
  const [state, action] = useActionState(saveSettingsAction, null);

  return (
    <form action={action} className="card overflow-hidden">
      <header className="border-b border-white/8 px-5 py-4">
        <h2 className="text-[15px] font-semibold">{title}</h2>
        {description && <p className="mt-0.5 text-[12px] text-mist-500">{description}</p>}
      </header>

      <input type="hidden" name="group" value={fields.map((f) => f.key).join(",")} />

      <div className={`grid gap-4 p-5 ${columns === 2 ? "sm:grid-cols-2" : ""}`}>
        {fields.map((field) => {
          if (field.type === "boolean") {
            return (
              <label
                key={field.key}
                className="panel flex cursor-pointer items-start gap-3 p-3.5 sm:col-span-full"
              >
                <input
                  type="checkbox"
                  name={field.key}
                  defaultChecked={field.value}
                  value="1"
                  className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--accent-from)]"
                />
                <span className="min-w-0">
                  <span className="block text-[13.5px] font-medium">{field.label}</span>
                  {field.hint && (
                    <span className="mt-0.5 block text-[11.5px] leading-relaxed text-mist-500">
                      {field.hint}
                    </span>
                  )}
                </span>
              </label>
            );
          }

          if (field.type === "money") {
            return <MoneyField key={field.key} field={field} riyalLabel={riyalLabel} />;
          }

          if (field.type === "textarea") {
            return (
              <div key={field.key} className="sm:col-span-full">
                <Field label={field.label} hint={field.hint}>
                  <textarea name={field.key} defaultValue={String(field.value)} rows={4} className="field" />
                </Field>
              </div>
            );
          }

          return (
            <Field key={field.key} label={field.label} hint={field.hint}>
              <input
                name={field.key}
                defaultValue={String(field.value)}
                type={field.type === "number" ? "number" : "text"}
                min={field.type === "number" ? 0 : undefined}
                className="field"
                dir={field.type === "number" ? "ltr" : undefined}
              />
            </Field>
          );
        })}
      </div>

      <footer className="flex flex-wrap items-center gap-3 border-t border-white/8 px-5 py-4">
        <Submit>{saveLabel}</Submit>
        <Status state={state} />
      </footer>
    </form>
  );
}
