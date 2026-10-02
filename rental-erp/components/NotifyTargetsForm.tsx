"use client";

import { useActionState, useState } from "react";
import { SubmitButton } from "@/components/Form";
import { NOTIFICATION_KINDS } from "@/lib/constants";
import type { NotifyTarget } from "@/lib/notifications";
import type { FormState } from "@/lib/types";

const CHANNELS = { sms: "문자(SMS)", kakao: "카카오 알림톡", email: "이메일", webhook: "웹훅 URL" } as const;

export default function NotifyTargetsForm({ action, initial }: { action: (p: FormState, fd: FormData) => Promise<FormState>; initial: NotifyTarget[] }) {
  const [state, formAction] = useActionState(action, null);
  const [rows, setRows] = useState(() => {
    const base = initial.map((t) => ({ ...t }));
    while (base.length < 3) base.push({ channel: "sms", recipient: "", kinds: [] });
    return base;
  });
  return (
    <form action={formAction} className="space-y-3">
      {state?.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
      {state?.ok && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{state.ok}</p>}
      {rows.map((r, i) => (
        <div key={i} className="rounded-xl bg-slate-50 p-3">
          <div className="grid gap-2 sm:grid-cols-[180px_1fr]">
            <select
              name={`channel_${i}`}
              className="input"
              value={r.channel}
              onChange={(e) => setRows((p) => p.map((x, j) => (j === i ? { ...x, channel: e.target.value as NotifyTarget["channel"] } : x)))}
            >
              {Object.entries(CHANNELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
            <input
              name={`recipient_${i}`}
              className="input"
              placeholder={r.channel === "email" ? "ceo@example.com" : r.channel === "webhook" ? "https://..." : "010-0000-0000"}
              value={r.recipient}
              onChange={(e) => setRows((p) => p.map((x, j) => (j === i ? { ...x, recipient: e.target.value } : x)))}
            />
          </div>
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-600">
            {Object.entries(NOTIFICATION_KINDS).map(([k, v]) => (
              <label key={k} className="inline-flex items-center gap-1">
                <input
                  type="checkbox"
                  name={`kind_${i}_${k}`}
                  className="accent-navy-800"
                  checked={r.kinds.includes(k as NotifyTarget["kinds"][number])}
                  onChange={(e) =>
                    setRows((p) =>
                      p.map((x, j) =>
                        j === i
                          ? { ...x, kinds: e.target.checked ? [...x.kinds, k as NotifyTarget["kinds"][number]] : x.kinds.filter((y) => y !== k) }
                          : x,
                      ),
                    )
                  }
                />
                {v}
              </label>
            ))}
            <span className="text-slate-400">(아무것도 안 고르면 전체)</span>
          </div>
        </div>
      ))}
      <div className="flex gap-2">
        {rows.length < 6 && (
          <button type="button" className="btn-secondary" onClick={() => setRows((p) => [...p, { channel: "sms", recipient: "", kinds: [] }])}>
            + 줄 추가
          </button>
        )}
        <SubmitButton>저장</SubmitButton>
      </div>
    </form>
  );
}
