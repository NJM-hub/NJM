"use client";

import { useState, useTransition } from "react";
import type { FormState } from "@/lib/types";

/** 서버 동작을 실행하는 버튼 (확인창 · 결과 메시지) */
export default function ActionButton({
  action,
  children,
  confirm,
  className = "btn-secondary",
  prompt,
}: {
  action: (arg?: string) => Promise<FormState | void>;
  children: React.ReactNode;
  confirm?: string;
  className?: string;
  /** 입력이 필요하면 (예: 취소 사유) */
  prompt?: string;
}) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<FormState>(null);
  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        className={className}
        disabled={pending}
        onClick={() => {
          let arg: string | undefined;
          if (prompt) {
            const v = window.prompt(prompt);
            if (v == null) return;
            arg = v;
          } else if (confirm && !window.confirm(confirm)) return;
          start(async () => {
            const r = await action(arg);
            setMsg(r ?? null);
          });
        }}
      >
        {pending ? "처리 중..." : children}
      </button>
      {msg?.error && <span className="text-xs text-red-600">{msg.error}</span>}
      {msg?.ok && <span className="text-xs text-emerald-700">{msg.ok}</span>}
    </span>
  );
}
