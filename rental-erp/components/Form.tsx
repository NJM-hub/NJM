"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { wonShort } from "@/lib/format";
import type { FormState } from "@/lib/types";

export type FieldType = "text" | "money" | "date" | "month" | "number" | "select" | "textarea" | "checkbox" | "email" | "tel" | "password" | "hidden";

export type Field = {
  name: string;
  label?: string;
  type?: FieldType;
  options?: { value: string; label: string }[];
  required?: boolean;
  hint?: string;
  placeholder?: string;
  span?: 1 | 2 | 3 | 4;
  step?: string;
  suffix?: string;
  disabled?: boolean;
};

export type Section = { title?: string; desc?: string; fields: Field[] };

type Values = Record<string, string | boolean>;

export function SubmitButton({ children, className = "btn", pendingText = "저장 중..." }: { children: React.ReactNode; className?: string; pendingText?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending}>
      {pending ? pendingText : children}
    </button>
  );
}

const fmtMoney = (s: string) => {
  const digits = s.replace(/[^\d-]/g, "");
  if (!digits || digits === "-") return digits;
  return Number(digits).toLocaleString("ko-KR");
};

export function FieldInput({
  f,
  value,
  onChange,
  error,
}: {
  f: Field;
  value: string | boolean | undefined;
  onChange: (v: string | boolean) => void;
  error?: string;
}) {
  const id = `f-${f.name}`;
  const cls = `input ${error ? "input-error" : ""}`;
  const t = f.type ?? "text";
  if (t === "hidden") return <input type="hidden" name={f.name} value={String(value ?? "")} />;
  if (t === "checkbox") {
    return (
      <label className="flex items-center gap-2 pt-6 text-sm text-slate-700">
        <input type="checkbox" name={f.name} className="size-4 accent-navy-800" checked={!!value} onChange={(e) => onChange(e.target.checked)} disabled={f.disabled} />
        {f.label}
      </label>
    );
  }
  const str = String(value ?? "");
  let input: React.ReactNode;
  if (t === "select") {
    input = (
      <select id={id} name={f.name} className={cls} value={str} onChange={(e) => onChange(e.target.value)} disabled={f.disabled}>
        {!f.required && <option value="">선택 안 함</option>}
        {f.options?.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    );
  } else if (t === "textarea") {
    input = <textarea id={id} name={f.name} rows={3} className={cls} value={str} placeholder={f.placeholder} onChange={(e) => onChange(e.target.value)} disabled={f.disabled} />;
  } else if (t === "money") {
    input = (
      <div className="relative">
        <input
          id={id}
          name={f.name}
          inputMode="numeric"
          className={`${cls} pr-8 text-right tabular-nums`}
          value={str}
          placeholder={f.placeholder ?? "0"}
          onChange={(e) => onChange(fmtMoney(e.target.value))}
          disabled={f.disabled}
        />
        <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-slate-400">원</span>
      </div>
    );
  } else {
    input = (
      <div className="relative">
        <input
          id={id}
          name={f.name}
          type={t === "number" ? "text" : t === "month" ? "month" : t}
          inputMode={t === "number" ? "decimal" : undefined}
          step={f.step}
          className={`${cls} ${f.suffix ? "pr-10" : ""}`}
          value={str}
          placeholder={f.placeholder}
          onChange={(e) => onChange(e.target.value)}
          disabled={f.disabled}
          autoComplete={t === "password" ? "new-password" : undefined}
        />
        {f.suffix && <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-slate-400">{f.suffix}</span>}
      </div>
    );
  }
  const moneyHint = t === "money" && str && str !== "0" ? wonShort(Number(str.replace(/[^\d-]/g, ""))) : null;
  return (
    <div>
      {f.label && (
        <label className="label" htmlFor={id}>
          {f.label}
          {f.required && <span className="text-red-500"> *</span>}
        </label>
      )}
      {input}
      {error ? <p className="field-error">{error}</p> : f.hint || moneyHint ? <p className="hint">{[moneyHint, f.hint].filter(Boolean).join(" · ")}</p> : null}
    </div>
  );
}

const spanCls = { 1: "", 2: "sm:col-span-2", 3: "sm:col-span-3", 4: "sm:col-span-2 lg:col-span-4" } as const;

/** 필드 정의로 만드는 입력 폼. 저장 실패 시 입력값을 유지하고 오류를 칸 아래에 표시 */
export default function SmartForm({
  action,
  sections,
  initial = {},
  submitLabel = "저장",
  cancelHref,
  resetOnSuccess = false,
  children,
  cols = 3,
  values: controlled,
  onValuesChange,
}: {
  action: (p: FormState, fd: FormData) => Promise<FormState>;
  sections: Section[];
  initial?: Values;
  submitLabel?: string;
  cancelHref?: string;
  resetOnSuccess?: boolean;
  children?: React.ReactNode;
  cols?: 2 | 3 | 4;
  /** 바깥에서 값을 관리할 때 (AI 자동 입력 등) */
  values?: Values;
  onValuesChange?: (v: Values) => void;
}) {
  const [state, formAction] = useActionState(action, null);
  const [inner, setInner] = useState<Values>(() => normalize(initial, sections));
  const values = controlled ?? inner;
  const setValues = (fn: (p: Values) => Values) => (onValuesChange ? onValuesChange(fn(values)) : setInner(fn));
  const [last, setLast] = useState(state);
  if (state !== last) {
    setLast(state);
    if (state?.ok && resetOnSuccess) setInner(normalize(initial, sections));
  }
  const fe = state?.fieldErrors ?? {};
  const grid = cols === 2 ? "sm:grid-cols-2" : cols === 4 ? "sm:grid-cols-2 lg:grid-cols-4" : "sm:grid-cols-2 lg:grid-cols-3";
  return (
    <form action={formAction} className="space-y-5">
      {state?.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
      {state?.ok && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{state.ok}</p>}
      {sections.map((s, i) => (
        <fieldset key={i} className="space-y-3">
          {s.title && (
            <legend className="mb-1 text-sm font-bold text-navy-900">
              {s.title}
              {s.desc && <span className="ml-2 text-xs font-normal text-slate-500">{s.desc}</span>}
            </legend>
          )}
          <div className={`grid grid-cols-1 gap-3 ${grid}`}>
            {s.fields.map((f) => (
              <div key={f.name} className={f.type === "hidden" ? "hidden" : spanCls[f.span ?? (f.type === "textarea" ? 4 : 1)]}>
                <FieldInput f={f} value={values[f.name]} error={fe[f.name]} onChange={(v) => setValues((p) => ({ ...p, [f.name]: v }))} />
              </div>
            ))}
          </div>
        </fieldset>
      ))}
      {children}
      <div className="flex gap-2 pt-1">
        <SubmitButton>{submitLabel}</SubmitButton>
        {cancelHref && (
          <a href={cancelHref} className="btn-secondary">
            취소
          </a>
        )}
      </div>
    </form>
  );
}

export function normalize(initial: Values, sections: Section[]): Values {
  const out: Values = {};
  for (const s of sections)
    for (const f of s.fields) {
      const v = initial[f.name];
      if (f.type === "checkbox") out[f.name] = !!v;
      else if (f.type === "money" && v !== undefined && v !== null && v !== "") out[f.name] = fmtMoney(String(v));
      else if (f.type === "select" && (v === undefined || v === "") && f.required && f.options?.length) out[f.name] = f.options[0].value;
      else out[f.name] = v === undefined || v === null ? "" : String(v);
    }
  return out;
}
