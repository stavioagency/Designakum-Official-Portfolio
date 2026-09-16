"use client";

import { useState } from "react";
import { Check, X } from "@/components/icons";
import { fill, type Dictionary } from "@/lib/i18n";
import {
  PASSWORD_MIN,
  PASSWORD_RULES,
  passwordProblems,
  type PasswordRule,
} from "@/lib/password-policy";

/**
 * A password input that shows the rules as they are met.
 *
 * It runs `passwordProblems` — the same function the server runs — so the two
 * can never disagree about what is acceptable. The checklist appears once
 * someone starts typing rather than greeting an empty form with a list of
 * complaints.
 */
export function PasswordField({
  name,
  label,
  copy,
  min = PASSWORD_MIN,
  autoComplete = "new-password",
  id,
  children,
}: {
  name: string;
  label: string;
  copy: Dictionary["password"];
  min?: number;
  autoComplete?: string;
  id?: string;
  /** Anything that belongs beside the label, such as a "forgot password" link. */
  children?: React.ReactNode;
}) {
  const [value, setValue] = useState("");
  const failed = passwordProblems(value, min);
  const touched = value.length > 0;
  const ok = touched && failed.length === 0;

  const text = (rule: PasswordRule) =>
    rule === "length" ? fill(copy.length, { n: min }) : copy[rule];

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <label className="label" htmlFor={id ?? name}>{label}</label>
        {children}
      </div>

      <input
        id={id ?? name}
        name={name}
        type="password"
        dir="ltr"
        className="field"
        placeholder="••••••••"
        autoComplete={autoComplete}
        required
        value={value}
        onChange={(event) => setValue(event.target.value)}
      />

      {touched && (
        <div className="mt-2.5">
          <p className={`mb-1.5 text-[12px] ${ok ? "text-emerald-300" : "text-mist-400"}`}>
            {ok ? copy.met : copy.title}
          </p>
          <ul className="space-y-1">
            {PASSWORD_RULES.map((rule) => {
              const passed = !failed.includes(rule);
              return (
                <li
                  key={rule}
                  className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[12px] ${
                    passed ? "bg-emerald-400/10 text-emerald-200" : "bg-white/[0.04] text-mist-400"
                  }`}
                >
                  {passed ? (
                    <Check className="h-3.5 w-3.5 shrink-0" />
                  ) : (
                    <X className="h-3.5 w-3.5 shrink-0 opacity-50" />
                  )}
                  {text(rule)}
                </li>
              );
            })}
          </ul>
          {failed.includes("tooLong") && (
            <p className="mt-1.5 text-[12px] text-rose-300">{copy.tooLong}</p>
          )}
        </div>
      )}
    </div>
  );
}
