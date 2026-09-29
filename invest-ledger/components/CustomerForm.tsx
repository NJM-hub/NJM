"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import SubmitButton from "@/components/SubmitButton";
import type { Customer, FormState } from "@/lib/types";

export default function CustomerForm({
  action,
  customer,
}: {
  action: (prev: FormState, fd: FormData) => Promise<FormState>;
  customer: Customer;
}) {
  const [state, formAction] = useActionState(action, {} as FormState);
  const [name, setName] = useState(customer.name);
  const [phone, setPhone] = useState(customer.phone);
  const [memo, setMemo] = useState(customer.memo);
  const fe = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="card card-body space-y-4">
      {state.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="name">고객명 *</label>
          <input id="name" name="name" className={`input ${fe.name ? "input-error" : ""}`} value={name} onChange={(e) => setName(e.target.value)} />
          {fe.name && <p className="field-error">{fe.name}</p>}
        </div>
        <div>
          <label className="label" htmlFor="phone">연락처</label>
          <input id="phone" name="phone" inputMode="tel" className="input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="010-1234-5678" />
        </div>
      </div>
      <div>
        <label className="label" htmlFor="memo">메모</label>
        <textarea id="memo" name="memo" rows={3} className="input" value={memo} onChange={(e) => setMemo(e.target.value)}
          placeholder="주소, 소개자, 특이사항 등" />
      </div>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Link href={`/customers/${customer.id}`} className="btn-secondary">취소</Link>
        <SubmitButton>저장</SubmitButton>
      </div>
    </form>
  );
}
