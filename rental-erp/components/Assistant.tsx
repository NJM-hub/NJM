"use client";

import { useActionState, useState } from "react";
import type { AskState } from "@/app/actions/assistant";
import { SubmitButton } from "@/components/Form";

export default function Assistant({ action, samples, aiOn }: { action: (p: AskState, fd: FormData) => Promise<AskState>; samples: string[]; aiOn: boolean }) {
  const [state, formAction] = useActionState(action, null);
  const [q, setQ] = useState("");
  const [history, setHistory] = useState<{ q: string; a: string; source: string }[]>([]);
  const [last, setLast] = useState<AskState>(null);
  if (state !== last) {
    setLast(state);
    if (state && "a" in state) setHistory((h) => [{ q: state.q, a: state.a, source: state.source }, ...h].slice(0, 20));
  }
  return (
    <div className="space-y-4">
      <form action={formAction} className="flex gap-2">
        <input name="question" className="input !py-3 text-base" placeholder="예: 현재 임대사업 수익이 가장 좋은 건물이 뭐야?" value={q} onChange={(e) => setQ(e.target.value)} />
        <SubmitButton className="btn !px-5" pendingText="생각 중...">
          질문
        </SubmitButton>
      </form>
      <div className="flex flex-wrap gap-1.5">
        {samples.map((s) => (
          <button key={s} type="button" className="rounded-full bg-navy-50 px-3 py-1 text-sm text-navy-800 hover:bg-navy-100" onClick={() => setQ(s)}>
            {s}
          </button>
        ))}
      </div>
      {state && "error" in state && <p className="rounded-lg bg-orange-50 px-3 py-2 text-sm text-orange-800">{state.error}</p>}
      <div className="space-y-3">
        {history.map((h, i) => (
          <div key={i} className="card card-body">
            <div className="text-sm font-semibold text-slate-500">Q. {h.q}</div>
            <div className="mt-2 text-[15px] leading-7 whitespace-pre-wrap text-slate-900">{h.a}</div>
            <div className="mt-2 text-[11px] text-slate-400">{h.source === "ai" ? "✨ AI 답변 (장부 데이터 기준)" : "📐 자동 계산 답변"}</div>
          </div>
        ))}
      </div>
      {!aiOn && <p className="text-xs text-slate-500">AI 연결 안 됨: 환경변수 ANTHROPIC_API_KEY 를 넣으면 자유로운 질문도 답합니다. 지금은 예시와 비슷한 질문에 자동 계산으로 답합니다.</p>}
    </div>
  );
}
