"use client";

import { useActionState, useState } from "react";
import SubmitButton from "@/components/SubmitButton";
import type { FormState } from "@/lib/types";

export type Field =
  | { name: string; label: string; type: "text" | "email" | "password"; initial?: string; hint?: string; autoComplete?: string }
  | { name: string; label: string; type: "select"; options: { value: string; label: string }[]; initial?: string; hint?: string }
  | { name: string; label: string; type: "checkbox"; initial?: boolean; hint?: string };

/** 간단한 입력폼 (사용자 관리·내 계정 화면용) */
export default function SimpleForm({
  action,
  fields,
  submitLabel,
  danger = false,
  confirmText,
}: {
  action: (p: FormState, fd: FormData) => Promise<FormState>;
  fields: Field[];
  submitLabel: string;
  danger?: boolean;
  confirmText?: string;
}) {
  const [state, formAction] = useActionState(action, {} as FormState);
  const [v, setV] = useState<Record<string, string | boolean>>(() =>
    Object.fromEntries(fields.map((f) => [f.name, f.type === "checkbox" ? (f.initial ?? false) : (f.initial ?? "")])),
  );
  const fe = state.fieldErrors ?? {};
  const set = (k: string, val: string | boolean) => setV((p) => ({ ...p, [k]: val }));

  return (
    <form action={formAction} className="space-y-4"
      onSubmit={(e) => { if (confirmText && !confirm(confirmText)) e.preventDefault(); }}>
      {state.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
      <div className="grid gap-4 sm:grid-cols-2">
        {fields.map((f) => (
          <div key={f.name} className={f.type === "checkbox" ? "sm:col-span-2" : ""}>
            {f.type === "checkbox" ? (
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" name={f.name} checked={Boolean(v[f.name])} onChange={(e) => set(f.name, e.target.checked)}
                  className="size-4 accent-navy-800" />
                {f.label}
              </label>
            ) : (
              <>
                <label className="label" htmlFor={f.name}>{f.label}</label>
                {f.type === "select" ? (
                  <select id={f.name} name={f.name} className={`input ${fe[f.name] ? "input-error" : ""}`}
                    value={String(v[f.name])} onChange={(e) => set(f.name, e.target.value)}>
                    {f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                ) : (
                  <input id={f.name} name={f.name} type={f.type} autoComplete={f.autoComplete}
                    className={`input ${fe[f.name] ? "input-error" : ""}`}
                    value={String(v[f.name])} onChange={(e) => set(f.name, e.target.value)} />
                )}
              </>
            )}
            {f.hint && !fe[f.name] && <p className="hint">{f.hint}</p>}
            {fe[f.name] && <p className="field-error">{fe[f.name]}</p>}
          </div>
        ))}
      </div>
      <div className="flex justify-end">
        <SubmitButton className={danger ? "btn-danger" : "btn"}>{submitLabel}</SubmitButton>
      </div>
    </form>
  );
}
