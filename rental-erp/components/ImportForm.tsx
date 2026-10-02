"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/Form";
import { IMPORT_KINDS } from "@/lib/excel";
import type { FormState } from "@/lib/types";

const TEMPLATE: Record<string, string> = {
  properties: "properties",
  tenants: "tenants",
  contracts: "contracts",
  payments: "payments",
  loans: "loans",
  expenses: "expenses",
};

export default function ImportForm({ action }: { action: (p: FormState, fd: FormData) => Promise<FormState> }) {
  const [state, formAction] = useActionState(action, null);
  return (
    <form action={formAction} className="space-y-3">
      {state?.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
      {state?.ok && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{state.ok}</p>}
      <div className="grid gap-3 sm:grid-cols-[200px_1fr_auto] sm:items-end">
        <div>
          <label className="label">가져올 항목</label>
          <select name="kind" className="input" defaultValue="properties">
            {Object.entries(IMPORT_KINDS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">엑셀 파일 (.xlsx)</label>
          <input type="file" name="file" accept=".xlsx" className="input !py-1.5" required />
        </div>
        <SubmitButton pendingText="가져오는 중...">가져오기</SubmitButton>
      </div>
      <p className="text-xs leading-5 text-slate-500">
        순서: ① 부동산·호실 → ② 임차인 → ③ 계약 → ④ 입금·대출·비용. 머리글(첫 줄) 이름이 아래 &apos;내보내기&apos; 파일과 같으면 됩니다. 양식:{" "}
        {Object.entries(IMPORT_KINDS).map(([k, v]) => (
          <a key={k} href={`/api/export/${TEMPLATE[k]}`} className="link mr-2">
            {v}
          </a>
        ))}
        <br />
        같은 부동산명·호실, 같은 계약번호가 있으면 새로 만들지 않고 수정합니다. 과거부터 이어진 계약은 &apos;청구시작월&apos;이 비어 있으면 이번 달부터 월세가 청구됩니다.
      </p>
    </form>
  );
}
