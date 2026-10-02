"use client";

import { useActionState, useMemo, useState } from "react";
import { FieldInput, SubmitButton } from "@/components/Form";
import { PAYMENT_METHODS } from "@/lib/constants";
import type { FormState } from "@/lib/types";

export type PayContractOption = {
  id: string;
  label: string; // 임차인 / 부동산 호실
  charges: { id: string; label: string; unpaid: number; overdue: boolean }[];
};

const fmt = (n: number) => (n ? n.toLocaleString("ko-KR") : "");

/** 월세 입금 등록: 계약 선택 → 미납 청구월 선택 → 금액 자동 → 저장하면 미납에서 자동 차감 */
export default function PaymentForm({
  action,
  contracts,
  today,
  fixedContractId,
}: {
  action: (p: FormState, fd: FormData) => Promise<FormState>;
  contracts: PayContractOption[];
  today: string;
  fixedContractId?: string;
}) {
  const [state, formAction] = useActionState(action, null);
  const [contractId, setContractId] = useState(fixedContractId ?? contracts[0]?.id ?? "");
  const current = useMemo(() => contracts.find((c) => c.id === contractId), [contracts, contractId]);
  const firstOpen = current?.charges[0];
  const [chargeId, setChargeId] = useState(firstOpen?.id ?? "");
  const [amount, setAmount] = useState(fmt(firstOpen?.unpaid ?? 0));
  const [date, setDate] = useState(today);
  const [method, setMethod] = useState("transfer");
  const [memo, setMemo] = useState("");
  const [last, setLast] = useState(state);
  if (state !== last) {
    setLast(state);
    if (state?.ok) setMemo("");
  }

  // 계약을 바꾸거나, 입금 후 서버에서 미납 목록이 바뀌면 다음 미납월로
  const [lastKey, setLastKey] = useState({ contracts, contractId });
  if (lastKey.contracts !== contracts || lastKey.contractId !== contractId) {
    setLastKey({ contracts, contractId });
    const c = contracts.find((x) => x.id === contractId);
    const ch = c?.charges.find((x) => x.id === chargeId) ?? c?.charges[0];
    setChargeId(ch?.id ?? "");
    setAmount(fmt(ch?.unpaid ?? 0));
  }

  const total = current?.charges.reduce((s, c) => s + c.unpaid, 0) ?? 0;
  const fe = state?.fieldErrors ?? {};

  return (
    <form action={formAction} className="space-y-3">
      {state?.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
      {state?.ok && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{state.ok}</p>}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {fixedContractId ? (
          <input type="hidden" name="contract_id" value={contractId} />
        ) : (
          <div className="sm:col-span-2 lg:col-span-1">
            <label className="label" htmlFor="pf-contract">
              임차인 / 부동산 / 호실
            </label>
            <select id="pf-contract" name="contract_id" className="input" value={contractId} onChange={(e) => setContractId(e.target.value)}>
              {contracts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                  {c.charges.some((x) => x.overdue) ? " 🔴" : ""}
                </option>
              ))}
            </select>
            {fe.contract_id && <p className="field-error">{fe.contract_id}</p>}
          </div>
        )}
        <div>
          <label className="label" htmlFor="pf-charge">
            청구 월
          </label>
          <select
            id="pf-charge"
            name="charge_id"
            className="input"
            value={chargeId}
            onChange={(e) => {
              setChargeId(e.target.value);
              const ch = current?.charges.find((x) => x.id === e.target.value);
              setAmount(fmt(e.target.value ? (ch?.unpaid ?? 0) : total));
            }}
          >
            <option value="">자동 (가장 오래된 미납부터)</option>
            {current?.charges.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label} · 남은 {c.unpaid.toLocaleString()}원{c.overdue ? " (미납)" : ""}
              </option>
            ))}
          </select>
          <p className="hint">{total ? `받을 금액 합계 ${total.toLocaleString()}원` : "받을 금액이 없습니다 (선납 처리)"}</p>
        </div>
        <FieldInput f={{ name: "paid_date", label: "입금일", type: "date", required: true }} value={date} onChange={(v) => setDate(String(v))} error={fe.paid_date} />
        <FieldInput f={{ name: "amount", label: "입금금액", type: "money", required: true }} value={amount} onChange={(v) => setAmount(String(v))} error={fe.amount} />
        <FieldInput
          f={{ name: "method", label: "입금방법", type: "select", required: true, options: Object.entries(PAYMENT_METHODS).map(([value, label]) => ({ value, label })) }}
          value={method}
          onChange={(v) => setMethod(String(v))}
        />
        <FieldInput f={{ name: "memo", label: "메모" }} value={memo} onChange={(v) => setMemo(String(v))} />
      </div>
      <SubmitButton pendingText="처리 중...">입금 처리</SubmitButton>
    </form>
  );
}
