"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import SubmitButton from "@/components/SubmitButton";
import { expectedTotal, defaultStartOn, maturityOn } from "@/lib/calc";
import { DEFAULT_PERIOD, PERIOD_PRESETS, REPAYMENT_METHODS, methodLabel } from "@/lib/constants";
import { scheduleCount } from "@/lib/schedule";
import { isDate } from "@/lib/dates";
import { comma, parseMoney, won } from "@/lib/format";
import type { Customer, FormState, Investment } from "@/lib/types";

type Props = {
  action: (prev: FormState, fd: FormData) => Promise<FormState>;
  customers: Customer[];
  initial?: Investment;
  today: string;
  submitLabel: string;
  cancelHref: string;
  /** 고객 화면에서 [이 고객 투자 등록]으로 왔을 때 미리 선택할 고객 */
  initialCustomerId?: string;
};

type Values = {
  customerMode: "existing" | "new";
  customerId: string;
  customerName: string;
  customerPhone: string;
  investmentNo: string;
  targetName: string;
  executedOn: string;
  principal: string;
  returnRate: string;
  repaymentMethod: string;
  periodChoice: string; // "60" | "100" | "120" | "custom"
  periodCustom: string;
  startOn: string;
  maturityOn: string;
  memo: string;
};

function initialValues(initial: Investment | undefined, today: string, hasCustomers: boolean, customerId = ""): Values {
  if (initial) {
    const preset = (PERIOD_PRESETS as readonly number[]).includes(initial.period_days);
    return {
      customerMode: "existing",
      customerId: initial.customer_id,
      customerName: "",
      customerPhone: "",
      investmentNo: initial.investment_no,
      targetName: initial.target_name,
      executedOn: initial.executed_on,
      principal: comma(initial.principal),
      returnRate: String(Number(initial.return_rate)),
      repaymentMethod: initial.repayment_method,
      periodChoice: preset ? String(initial.period_days) : "custom",
      periodCustom: preset ? "" : String(initial.period_days),
      startOn: initial.start_on,
      maturityOn: initial.maturity_on,
      memo: initial.memo,
    };
  }
  const startOn = defaultStartOn(today);
  return {
    customerMode: hasCustomers ? "existing" : "new",
    customerId,
    customerName: "",
    customerPhone: "",
    investmentNo: "",
    targetName: "",
    executedOn: today,
    principal: "",
    returnRate: "20",
    repaymentMethod: "daily",
    periodChoice: String(DEFAULT_PERIOD),
    periodCustom: "",
    startOn,
    maturityOn: maturityOn(startOn, DEFAULT_PERIOD),
    memo: "",
  };
}

function periodOf(v: Values): number {
  return Number(v.periodChoice === "custom" ? v.periodCustom : v.periodChoice);
}

/** 기간·시작일이 바뀌면 만기일을 다시 계산 */
function withMaturity(v: Values): Values {
  const days = periodOf(v);
  if (!isDate(v.startOn) || !Number.isInteger(days) || days < 1) return v;
  return { ...v, maturityOn: maturityOn(v.startOn, days) };
}

export default function InvestmentForm({ action, customers, initial, today, submitLabel, cancelHref, initialCustomerId }: Props) {
  const [state, formAction] = useActionState(action, {} as FormState);
  const [v, setV] = useState<Values>(() => initialValues(initial, today, customers.length > 0, initialCustomerId));
  const fe = state.fieldErrors ?? {};

  const set = (patch: Partial<Values>) => setV((prev) => ({ ...prev, ...patch }));
  const principalNum = parseMoney(v.principal);
  const rateNum = Number(v.returnRate);
  const total = principalNum > 0 && Number.isFinite(rateNum) ? expectedTotal(principalNum, rateNum) : 0;
  const days = periodOf(v);
  const rounds = isDate(v.startOn) && isDate(v.maturityOn) ? scheduleCount(v.startOn, v.maturityOn, v.repaymentMethod) : 0;

  const err = (k: string) => (fe[k] ? <p className="field-error">{fe[k]}</p> : null);
  const cls = (k: string) => `input ${fe[k] ? "input-error" : ""}`;

  return (
    <form action={formAction} className="space-y-5">
      {state.error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{state.error}</div>
      )}
      {Object.keys(fe).length > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          입력 내용을 확인해주세요. 빨간색으로 표시된 항목을 수정하면 저장할 수 있습니다.
        </div>
      )}

      {/* 고객 */}
      <section className="card card-body">
        <h2 className="mb-4 text-base font-semibold text-navy-900">고객 정보</h2>
        <input type="hidden" name="customer_mode" value={v.customerMode} />
        <div className="mb-4 inline-flex rounded-lg bg-slate-100 p-1 text-sm">
          {(["existing", "new"] as const).map((m) => (
            <button
              key={m}
              type="button"
              disabled={m === "existing" && customers.length === 0}
              onClick={() => set({ customerMode: m })}
              className={`rounded-md px-3 py-1.5 font-medium disabled:opacity-40 ${
                v.customerMode === m ? "bg-white text-navy-900 shadow-sm" : "text-slate-500"
              }`}
            >
              {m === "existing" ? "기존 고객 선택" : "새 고객 입력"}
            </button>
          ))}
        </div>

        {v.customerMode === "existing" ? (
          <div>
            <label className="label" htmlFor="customer_id">고객 *</label>
            <select
              id="customer_id"
              name="customer_id"
              className={cls("customer_id")}
              value={v.customerId}
              onChange={(e) => set({ customerId: e.target.value })}
            >
              <option value="">고객을 선택하세요</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.phone && `(${c.phone})`}
                </option>
              ))}
            </select>
            {err("customer_id")}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="customer_name">고객명 *</label>
              <input id="customer_name" name="customer_name" className={cls("customer_name")}
                value={v.customerName} onChange={(e) => set({ customerName: e.target.value })} placeholder="홍길동" />
              {err("customer_name")}
            </div>
            <div>
              <label className="label" htmlFor="customer_phone">연락처</label>
              <input id="customer_phone" name="customer_phone" className="input" inputMode="tel"
                value={v.customerPhone} onChange={(e) => set({ customerPhone: e.target.value })} placeholder="010-1234-5678" />
              <p className="hint">이름과 연락처가 같은 고객이 이미 있으면 그 고객으로 연결됩니다.</p>
            </div>
          </div>
        )}
      </section>

      {/* 투자 */}
      <section className="card card-body">
        <h2 className="mb-4 text-base font-semibold text-navy-900">투자 정보</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="investment_no">투자번호</label>
            <input id="investment_no" name="investment_no" className={cls("investment_no")}
              value={v.investmentNo} onChange={(e) => set({ investmentNo: e.target.value })}
              placeholder={initial ? "" : "비워두면 자동 생성 (예: INV-00001)"} />
            {err("investment_no")}
          </div>
          <div>
            <label className="label" htmlFor="target_name">투자 대상명 *</label>
            <input id="target_name" name="target_name" className={cls("target_name")}
              value={v.targetName} onChange={(e) => set({ targetName: e.target.value })} placeholder="예: ○○상사" />
            {err("target_name")}
          </div>
          <div>
            <label className="label" htmlFor="executed_on">투자 실행일 *</label>
            <input id="executed_on" name="executed_on" type="date" className={cls("executed_on")}
              value={v.executedOn}
              onChange={(e) => {
                const executedOn = e.target.value;
                setV((prev) =>
                  isDate(executedOn) ? withMaturity({ ...prev, executedOn, startOn: defaultStartOn(executedOn) }) : { ...prev, executedOn },
                );
              }} />
            {err("executed_on")}
          </div>
          <div>
            <label className="label" htmlFor="principal">투자 실행금액 (원) *</label>
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-slate-400">₩</span>
              <input id="principal" name="principal" inputMode="numeric" className={`${cls("principal")} pl-7 text-right tabular-nums`}
                value={v.principal} onChange={(e) => set({ principal: comma(e.target.value) })} placeholder="100,000,000" />
            </div>
            {err("principal")}
          </div>
          <div>
            <label className="label" htmlFor="return_rate">수익률 (%) *</label>
            <input id="return_rate" name="return_rate" inputMode="decimal" className={`${cls("return_rate")} text-right`}
              value={v.returnRate} onChange={(e) => set({ returnRate: e.target.value.replace(/[^\d.]/g, "") })} placeholder="20" />
            {err("return_rate")}
          </div>
          <div>
            <span className="label">총 회수 예정금액 (자동 계산)</span>
            <div className="rounded-lg border border-navy-100 bg-navy-50 px-3 py-2 text-right text-sm font-bold text-navy-900 tabular-nums">
              {total ? won(total) : "-"}
            </div>
            {total > 0 && <p className="hint text-right">수익 {won(total - principalNum)}</p>}
          </div>
        </div>
      </section>

      {/* 회수 조건 */}
      <section className="card card-body">
        <h2 className="mb-4 text-base font-semibold text-navy-900">회수 조건</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="repayment_method">회수방식 *</label>
            <select id="repayment_method" name="repayment_method" className={cls("repayment_method")}
              value={v.repaymentMethod} onChange={(e) => set({ repaymentMethod: e.target.value })}>
              {REPAYMENT_METHODS.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
            {err("repayment_method")}
          </div>
          <div>
            <span className="label">회수기간 *</span>
            <input type="hidden" name="period_days" value={Number.isFinite(days) ? days : ""} />
            <div className="flex flex-wrap gap-2">
              {[...PERIOD_PRESETS.map(String), "custom"].map((p) => (
                <button key={p} type="button"
                  onClick={() => setV((prev) => withMaturity({ ...prev, periodChoice: p }))}
                  className={`rounded-lg border px-3 py-2 text-sm font-medium ${
                    v.periodChoice === p ? "border-navy-800 bg-navy-800 text-white" : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                  }`}>
                  {p === "custom" ? "직접 입력" : `${p}일`}
                </button>
              ))}
              {v.periodChoice === "custom" && (
                <div className="flex items-center gap-1">
                  <input inputMode="numeric" className={`${cls("period_days")} w-24 text-right`} autoFocus
                    value={v.periodCustom}
                    onChange={(e) => setV((prev) => withMaturity({ ...prev, periodCustom: e.target.value.replace(/\D/g, "") }))}
                    placeholder="90" />
                  <span className="text-sm text-slate-600">일</span>
                </div>
              )}
            </div>
            {err("period_days")}
          </div>
          <div>
            <label className="label" htmlFor="start_on">회수 시작일 *</label>
            <input id="start_on" name="start_on" type="date" className={cls("start_on")}
              value={v.startOn} onChange={(e) => setV((prev) => withMaturity({ ...prev, startOn: e.target.value }))} />
            <p className="hint">기본값: 실행일 다음 날</p>
            {err("start_on")}
          </div>
          <div>
            <label className="label" htmlFor="maturity_on">회수 만기일 *</label>
            <input id="maturity_on" name="maturity_on" type="date" className={cls("maturity_on")}
              value={v.maturityOn} onChange={(e) => set({ maturityOn: e.target.value })} />
            <p className="hint">시작일 + 회수기간 − 1일로 자동 계산 (직접 수정 가능)</p>
            {err("maturity_on")}
          </div>
          {rounds > 0 && total > 0 && (
            <div className="rounded-lg border border-navy-100 bg-navy-50 px-3 py-2 text-sm text-navy-900 sm:col-span-2">
              회수계획 미리보기: <b>{methodLabel(v.repaymentMethod)} {rounds}회</b>, 1회 약 <b>{won(Math.floor(total / rounds))}</b>
              <span className="text-xs text-slate-500"> (저장하면 회차별 예정일·금액이 자동으로 만들어집니다)</span>
            </div>
          )}
          <div className="sm:col-span-2">
            <label className="label" htmlFor="memo">메모</label>
            <textarea id="memo" name="memo" rows={3} className="input"
              value={v.memo} onChange={(e) => set({ memo: e.target.value })} placeholder="특이사항, 담보, 계약 조건 등" />
          </div>
        </div>
      </section>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Link href={cancelHref} className="btn-secondary">취소</Link>
        <SubmitButton>{submitLabel}</SubmitButton>
      </div>
    </form>
  );
}
