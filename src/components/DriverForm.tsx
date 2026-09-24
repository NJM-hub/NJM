"use client";
import { useActionState } from "react";
import type { DriverFormState } from "@/lib/drivers/save";

export type DriverFormValues = {
  name?: string; phone?: string; address?: string | null; rrn_masked?: string | null;
  bank_name?: string | null; bank_account_masked?: string | null; account_holder?: string | null;
  license_number?: string | null; license_expiry?: string | null;
};

const BANKS = ["국민은행", "신한은행", "우리은행", "하나은행", "농협은행", "기업은행", "카카오뱅크", "토스뱅크", "케이뱅크", "SC제일은행", "새마을금고", "우체국", "수협", "신협", "부산은행", "대구은행", "경남은행", "광주은행", "전북은행", "제주은행"];

export function DriverForm({
  action,
  initial,
  isNew,
  submitLabel = "저장",
}: {
  action: (prev: DriverFormState, f: FormData) => Promise<DriverFormState>;
  initial?: DriverFormValues;
  isNew: boolean;
  submitLabel?: string;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  return (
    <form action={formAction} className="space-y-6">
      <section className="card grid gap-4 sm:grid-cols-2">
        <h2 className="font-semibold sm:col-span-2">기본 정보</h2>
        <Field label="이름 *"><input name="name" required defaultValue={initial?.name} className="input" /></Field>
        <Field label="휴대폰 *"><input name="phone" required defaultValue={initial?.phone} placeholder="010-0000-0000" className="input" inputMode="tel" /></Field>
        <Field label="주소" wide><input name="address" defaultValue={initial?.address ?? ""} className="input" /></Field>
        <Field label="운전면허번호"><input name="license_number" defaultValue={initial?.license_number ?? ""} placeholder="11-00-000000-00" className="input" /></Field>
        <Field label="면허 적성검사 만료일"><input name="license_expiry" type="date" defaultValue={initial?.license_expiry ?? ""} className="input" /></Field>
      </section>

      <section className="card grid gap-4 sm:grid-cols-2">
        <h2 className="font-semibold sm:col-span-2">정산·세무 정보 <span className="text-xs font-normal text-gray-500">(암호화되어 저장됩니다)</span></h2>
        <Field label={`주민등록번호 ${initial?.rrn_masked ? `(현재 ${initial.rrn_masked}, 바꿀 때만 입력)` : "*"}`}>
          <input name="rrn" placeholder="000000-0000000" className="input" autoComplete="off" inputMode="numeric" />
        </Field>
        <Field label="은행 *">
          <input name="bank_name" list="banks" defaultValue={initial?.bank_name ?? ""} className="input" />
          <datalist id="banks">{BANKS.map((b) => <option key={b} value={b} />)}</datalist>
        </Field>
        <Field label={`계좌번호 ${initial?.bank_account_masked ? `(현재 ${initial.bank_account_masked}, 바꿀 때만 입력)` : "*"}`}>
          <input name="bank_account" className="input" autoComplete="off" inputMode="numeric" />
        </Field>
        <Field label="예금주 *"><input name="account_holder" defaultValue={initial?.account_holder ?? ""} className="input" /></Field>
      </section>

      {isNew && (
        <section className="card space-y-3 text-sm">
          <h2 className="font-semibold">개인정보 수집·이용 동의</h2>
          <div className="max-h-48 overflow-y-auto rounded-lg bg-gray-50 p-3 text-xs leading-relaxed text-gray-600">
            <p><b>수집 항목</b>: 이름, 휴대폰번호, 주소, 이메일, 운전면허번호·만료일, 주민등록번호, 은행명·계좌번호·예금주</p>
            <p><b>수집 목적</b>: 운행 배차 및 연락, 운행 대가 정산·지급, 사업소득 원천징수 및 지급명세서 제출 등 세무신고</p>
            <p><b>고유식별정보(주민등록번호) 처리 근거</b>: 소득세법 제145조·제164조 및 같은 법 시행령 제213조(원천징수 및 지급명세서 제출 의무)</p>
            <p><b>보유 기간</b>: 계약 종료 후 5년 (국세기본법 제85조의3 장부 등 보존 의무) 경과 시 파기</p>
            <p>동의를 거부할 수 있으나, 거부 시 정산 및 세무처리가 불가능하여 배차를 받을 수 없습니다.</p>
          </div>
          <label className="flex items-start gap-2"><input type="checkbox" name="privacy_consent" required className="mt-1" /> [필수] 개인정보 및 고유식별정보(주민등록번호) 수집·이용에 동의합니다.</label>
          <label className="flex items-start gap-2"><input type="checkbox" name="third_party_consent" className="mt-1" /> [선택] 원활한 운행을 위해 배차된 고객에게 이름·연락처·차량번호를 제공하는 데 동의합니다.</label>
        </section>
      )}

      {state && <p className={`text-sm ${state.ok ? "text-green-700" : "text-red-600"}`}>{state.message}</p>}
      <button className="btn" disabled={pending}>{pending ? "저장 중..." : submitLabel}</button>
    </form>
  );
}

function Field({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? "sm:col-span-2" : ""}>
      <label className="label">{label}</label>
      {children}
    </div>
  );
}
