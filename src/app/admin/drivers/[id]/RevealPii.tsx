"use client";
import { useState, useTransition } from "react";
import { revealDriverPii } from "../actions";

export function RevealPii({ id }: { id: string }) {
  const [data, setData] = useState<{ rrn: string | null; account: string | null } | null>(null);
  const [pending, start] = useTransition();
  if (data) {
    return (
      <div className="rounded-lg bg-gray-50 p-3">
        <div>주민등록번호: <b>{data.rrn ?? "-"}</b></div>
        <div>계좌번호: <b>{data.account ?? "-"}</b></div>
        <button className="mt-1 text-xs text-blue-600" onClick={() => setData(null)}>숨기기</button>
      </div>
    );
  }
  return (
    <button className="btn-secondary" disabled={pending} onClick={() => start(async () => setData(await revealDriverPii(id)))}>
      {pending ? "불러오는 중..." : "주민번호·계좌 원문 보기"}
    </button>
  );
}
