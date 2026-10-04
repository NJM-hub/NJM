"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { DOCUMENT_CATEGORIES } from "@/lib/constants";
import { prepareUpload } from "@/lib/shrink";

/** 문서 올리기 (PDF/JPG/PNG, 최대 1GB — 4MB 넘으면 자동 압축) */
export default function DocumentUpload({
  context,
  defaultCategory = "etc",
  properties,
}: {
  context: { property_id?: string; contract_id?: string; tenant_id?: string; loan_id?: string; unit_id?: string };
  defaultCategory?: string;
  properties?: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [category, setCategory] = useState(defaultCategory);
  const [title, setTitle] = useState("");
  const [propertyId, setPropertyId] = useState(context.property_id ?? properties?.[0]?.id ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok?: string; error?: string }>({});

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return setMsg({ error: "파일을 선택하세요." });
    setBusy(true);
    setMsg({});
    let prepared;
    try {
      prepared = await prepareUpload(file, (m) => setMsg({ ok: m }));
    } catch (err) {
      setBusy(false);
      return setMsg({ error: err instanceof Error ? err.message : String(err) });
    }
    setMsg({ ok: "올리는 중..." });
    const fd = new FormData();
    fd.set("file", prepared.file);
    fd.set("category", category);
    fd.set("title", title);
    for (const [k, v] of Object.entries({ ...context, property_id: propertyId || context.property_id })) if (v) fd.set(k, v);
    const r = await fetch("/api/documents", { method: "POST", body: fd });
    const j = await r.json().catch(() => ({ error: `업로드 실패 (${r.status})` }));
    setBusy(false);
    if (!r.ok) return setMsg({ error: j.error ?? "업로드 실패" });
    setMsg({ ok: prepared.note ? `저장했습니다. ${prepared.note}` : "저장했습니다." });
    setFile(null);
    setTitle("");
    (e.target as HTMLFormElement).reset();
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="grid gap-2 rounded-xl bg-slate-50 p-3 sm:grid-cols-[160px_1fr_1fr_auto] sm:items-end">
      {properties && (
        <div className="sm:col-span-4">
          <label className="label">부동산</label>
          <select className="input" value={propertyId} onChange={(e) => setPropertyId(e.target.value)}>
            {properties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      )}
      <div>
        <label className="label">문서 구분</label>
        <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
          {Object.entries(DOCUMENT_CATEGORIES).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="label">제목 (선택)</label>
        <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="예: 2026 등기부등본" />
      </div>
      <div>
        <label className="label">파일 (PDF·JPG·PNG, 최대 1GB)</label>
        <input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className="input !py-1.5" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      </div>
      <button className="btn" disabled={busy}>
        {busy ? "올리는 중..." : "올리기"}
      </button>
      {(msg.error || msg.ok) && <p className={`text-sm sm:col-span-4 ${msg.error ? "text-red-600" : "text-emerald-700"}`}>{msg.error ?? msg.ok}</p>}
    </form>
  );
}
