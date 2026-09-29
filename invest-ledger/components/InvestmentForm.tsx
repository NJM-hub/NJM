"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import { defaultMaturityOn, defaultStartOn, expectedTotal, installmentCount } from "@/lib/calc";
import {
  INVESTMENT_STATUSES,
  REPAYMENT_METHODS,
  TERM_PRESETS,
  isRepaymentMethod,
} from "@/lib/constants";
import { isValidDate } from "@/lib/dates";
import { parseAmount, rate, won, withComma } from "@/lib/format";
import type { FormState, InvestmentFormValues } from "@/lib/investmentForm";
import type { Customer } from "@/lib/types";

type Props = {
  mode: "create" | "edit";
  initial: InvestmentFormValues;
  customers: Customer[];
  action: (prev: FormState, fd: FormData) => Promise<FormState>;
  cancelHref: string;
};

export default function InvestmentForm({ mode, initial, customers, action, cancelHref }: Props) {
  const [state, formAction, pending] = useActionState(action, { ok: true });
  const [v, setV] = useState<InvestmentFormValues>(initial);
  // 사용자가 시작일/만기일을 직접 고치기 전까지는 자동 계산
  const [autoStart, setAutoStart] = useState(mode === "create");
  const [autoMaturity, setAutoMaturity] = useState(
    mode === "create" ||
      (isValidDate(initial.start_on) &&
        initial.maturity_on === defaultMaturityOn(initial.start_on, Number(initial.term_days))),
  );
  const [customTerm, setCustomTerm] = useState(
    !TERM_PRESETS.includes(Number(initial.term_days) as (typeof TERM_PRESETS)[number]),
  );

  const errors = state.errors ?? {};

  /** 값 변경 + 연결된 날짜 자동 계산 */
  function update(patch: Partial<InvestmentFormValues>) {
    setV((prev) => {
      const next = { ...prev, ...patch };
      if (autoStart && patch.executed_on !== undefined && isValidDate(next.executed_on)) {
        next.start_on = defaultStartOn(next.executed_on);
      }
      const term = Number(next.term_days);
      if (autoMaturity && isValidDate(next.start_on) && Number.isInteger(term) && term > 0) {
        next.maturity_on = defaultMaturityOn(next.start_on, term);
      }
      return next;
    });
  }

  function pickCustomer(name: string) {
    const match = customers.filter((c) => c.name === name);
    // 같은 이름 고객이 한 명뿐이면 연락처 자동 입력
    if (match.length === 1 && !v.customer_phone) update({ customer_name: name, customer_phone: match[0].phone ?? "" });
    else update({ customer_name: name });
  }

  const preview = useMemo(() => {
    const principal = parseAmount(v.principal);
    const r = Number(v.return_rate || 0);
    const term = Number(v.term_days);
    if (!Number.isFinite(principal) || principal <= 0 || !Number.isFinite(r)) return null;
    const total = expectedTotal(principal, r);
    const count =
      isRepaymentMethod(v.repayment_method) && Number.isInteger(term) && term > 0
        ? installmentCount(v.repayment_method, term)
        : null;
    return { principal, total, profit: total - principal, count, per: count ? Math.ceil(total / count) : null };
  }, [v.principal, v.return_rate, v.term_days, v.repayment_method]);

  const err = (key: keyof InvestmentFormValues) =>
    errors[key as keyof typeof errors] ? (
      <p className="field-error">{errors[key as keyof typeof errors]}</p>
    ) : null;
  const cls = (key: keyof InvestmentFormValues) => `input ${errors[key as keyof typeof errors] ? "input-error" : ""}`;

  return (
    <form action={formAction} className="grid gap-5 lg:grid-cols-3">
      <div className="space-y-5 lg:col-span-2">
        {state.message && !state.ok && (
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{state.message}</div>
        )}

        <section className="card">
          <h2 className="card-title">기본 정보</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="investment_no">
                투자번호
              </label>
              <input
                id="investment_no"
                name="investment_no"
                className={cls("investment_no")}
                value={v.investment_no}
                onChange={(e) => update({ investment_no: e.target.value })}
                placeholder={mode === "create" ? "비워두면 자동 부여 (INV-2026-0001)" : ""}
              />
              {err("investment_no")}
            </div>
            <div>
              <label className="label" htmlFor="executed_on">
                투자 실행일 *
              </label>
              <input
                id="executed_on"
                name="executed_on"
                type="date"
                className={cls("executed_on")}
                value={v.executed_on}
                onChange={(e) => update({ executed_on: e.target.value })}
                required
              />
              {err("executed_on")}
            </div>
            <div>
              <label className="label" htmlFor="principal">
                투자 실행금액 (원) *
              </label>
              <input
                id="principal"
                name="principal"
                inputMode="numeric"
                className={`${cls("principal")} text-right`}
                value={v.principal}
                onChange={(e) => update({ principal: withComma(e.target.value) })}
                placeholder="100,000,000"
                required
              />
              {err("principal")}
            </div>
            <div>
              <label className="label" htmlFor="return_rate">
                수익률 (%) *
              </label>
              <input
                id="return_rate"
                name="return_rate"
                inputMode="decimal"
                className={`${cls("return_rate")} text-right`}
                value={v.return_rate}
                onChange={(e) => update({ return_rate: e.target.value.replace(/[^\d.]/g, "") })}
                placeholder="20"
                required
              />
              {err("return_rate")}
            </div>
            <div className="sm:col-span-2">
              <label className="label" htmlFor="target_name">
                투자 대상명 *
              </label>
              <input
                id="target_name"
                name="target_name"
                className={cls("target_name")}
                value={v.target_name}
                onChange={(e) => update({ target_name: e.target.value })}
                required
              />
              {err("target_name")}
            </div>
          </div>
        </section>

        <section className="card">
          <h2 className="card-title">고객 정보</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="customer_name">
                고객명 *
              </label>
              <input
                id="customer_name"
                name="customer_name"
                list="customer-list"
                autoComplete="off"
                className={cls("customer_name")}
                value={v.customer_name}
                onChange={(e) => pickCustomer(e.target.value)}
                required
              />
              <datalist id="customer-list">
                {customers.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.phone ?? ""}
                  </option>
                ))}
              </datalist>
              {err("customer_name")}
            </div>
            <div>
              <label className="label" htmlFor="customer_phone">
                연락처
              </label>
              <input
                id="customer_phone"
                name="customer_phone"
                type="tel"
                inputMode="tel"
                className={cls("customer_phone")}
                value={v.customer_phone}
                onChange={(e) => update({ customer_phone: e.target.value })}
                placeholder="010-0000-0000"
              />
              {err("customer_phone")}
            </div>
          </div>
          <p className="mt-3 text-xs text-slate-500">
            이름과 연락처가 같은 기존 고객이 있으면 그 고객에 연결되고, 없으면 새 고객으로 등록됩니다.
          </p>
        </section>

        <section className="card">
          <h2 className="card-title">회수 조건</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <span className="label">회수방식 *</span>
              <div className="flex flex-wrap gap-2">
                {Object.entries(REPAYMENT_METHODS).map(([value, label]) => (
                  <label
                    key={value}
                    className={`cursor-pointer rounded-md border px-3 py-2 text-sm ${
                      v.repayment_method === value
                        ? "border-navy-800 bg-navy-800 text-white"
                        : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <input
                      type="radio"
                      name="repayment_method"
                      value={value}
                      checked={v.repayment_method === value}
                      onChange={() => update({ repayment_method: value })}
                      className="sr-only"
                    />
                    {label}
                  </label>
                ))}
              </div>
              {err("repayment_method")}
            </div>

            <div className="sm:col-span-2">
              <span className="label">회수기간 *</span>
              <div className="flex flex-wrap items-center gap-2">
                {TERM_PRESETS.map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => {
                      setCustomTerm(false);
                      update({ term_days: String(d) });
                    }}
                    className={`rounded-md border px-3 py-2 text-sm ${
                      !customTerm && Number(v.term_days) === d
                        ? "border-navy-800 bg-navy-800 text-white"
                        : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    {d}일
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setCustomTerm(true)}
                  className={`rounded-md border px-3 py-2 text-sm ${
                    customTerm ? "border-navy-800 bg-navy-800 text-white" : "border-slate-300 bg-white text-slate-700"
                  }`}
                >
                  직접 입력
                </button>
                {customTerm ? (
                  <span className="flex items-center gap-1">
                    <input
                      name="term_days"
                      inputMode="numeric"
                      className={`${cls("term_days")} w-24 text-right`}
                      value={v.term_days}
                      onChange={(e) => update({ term_days: e.target.value.replace(/\D/g, "") })}
                      autoFocus
                    />
                    <span className="text-sm text-slate-600">일</span>
                  </span>
                ) : (
                  <input type="hidden" name="term_days" value={v.term_days} />
                )}
              </div>
              {err("term_days")}
            </div>

            <div>
              <label className="label" htmlFor="start_on">
                회수 시작일 *
              </label>
              <input
                id="start_on"
                name="start_on"
                type="date"
                className={cls("start_on")}
                value={v.start_on}
                onChange={(e) => {
                  setAutoStart(false);
                  update({ start_on: e.target.value });
                }}
                required
              />
              <p className="mt-1 text-xs text-slate-500">기본값: 투자 실행일 다음 날</p>
              {err("start_on")}
            </div>
            <div>
              <label className="label" htmlFor="maturity_on">
                회수 만기일 *
              </label>
              <input
                id="maturity_on"
                name="maturity_on"
                type="date"
                className={cls("maturity_on")}
                value={v.maturity_on}
                onChange={(e) => {
                  setAutoMaturity(false);
                  setV((prev) => ({ ...prev, maturity_on: e.target.value }));
                }}
                required
              />
              <p className="mt-1 text-xs text-slate-500">
                {autoMaturity ? (
                  "자동 계산: 시작일 포함 회수기간의 마지막 날"
                ) : (
                  <button
                    type="button"
                    className="text-navy-600 underline"
                    onClick={() => {
                      setAutoMaturity(true);
                      const term = Number(v.term_days);
                      if (isValidDate(v.start_on) && term > 0)
                        setV((prev) => ({ ...prev, maturity_on: defaultMaturityOn(prev.start_on, term) }));
                    }}
                  >
                    직접 입력함 · 자동 계산으로 되돌리기
                  </button>
                )}
              </p>
              {err("maturity_on")}
            </div>
          </div>
        </section>

        <section className="card">
          <h2 className="card-title">기타</h2>
          <div className="grid gap-4">
            {mode === "edit" && (
              <div className="sm:w-1/2">
                <label className="label" htmlFor="status">
                  상태
                </label>
                <select
                  id="status"
                  name="status"
                  className={cls("status")}
                  value={v.status}
                  onChange={(e) => update({ status: e.target.value })}
                >
                  {Object.entries(INVESTMENT_STATUSES).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className="label" htmlFor="memo">
                메모
              </label>
              <textarea
                id="memo"
                name="memo"
                rows={3}
                className={cls("memo")}
                value={v.memo}
                onChange={(e) => update({ memo: e.target.value })}
              />
            </div>
          </div>
        </section>
      </div>

      {/* 오른쪽: 자동 계산 미리보기 + 저장 버튼 */}
      <aside className="lg:col-span-1">
        <div className="card space-y-3 lg:sticky lg:top-8">
          <h2 className="card-title mb-2">자동 계산</h2>
          <Row label="투자 실행금액" value={preview ? won(preview.principal) : "-"} />
          <Row label="수익률" value={rate(v.return_rate || 0)} />
          <Row label="예상 수익" value={preview ? won(preview.profit) : "-"} />
          <div className="border-t border-slate-200 pt-3">
            <Row label="총 회수 예정금액" value={preview ? won(preview.total) : "-"} strong />
          </div>
          <Row
            label="회수 횟수"
            value={preview?.count ? `${preview.count.toLocaleString("ko-KR")}회` : "-"}
          />
          <Row label="회당 약" value={preview?.per ? won(preview.per) : "-"} />
          <p className="text-xs text-slate-500">회당 금액은 참고용입니다. 회차별 계획은 2단계에서 만들어집니다.</p>
          <div className="flex gap-2 pt-2">
            <button type="submit" className="btn flex-1" disabled={pending}>
              {pending ? "저장 중..." : mode === "create" ? "투자 등록" : "수정 저장"}
            </button>
            <Link href={cancelHref} className="btn-secondary">
              취소
            </Link>
          </div>
        </div>
      </aside>
    </form>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className={`text-right tabular-nums ${strong ? "text-base font-bold text-navy-900" : "text-slate-800"}`}>
        {value}
      </span>
    </div>
  );
}
