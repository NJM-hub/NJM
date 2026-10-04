"use client";

import { useState } from "react";
import SmartForm, { normalize, type Section } from "@/components/Form";
import { prepareUpload } from "@/lib/shrink";
import type { FormState } from "@/lib/types";

type Values = Record<string, string | boolean>;

type Extraction = {
  landlord_name: string | null;
  tenant_name: string | null;
  tenant_phone: string | null;
  tenant_biz_no: string | null;
  property_description: string | null;
  address: string | null;
  unit_no: string | null;
  contract_date: string | null;
  start_date: string | null;
  end_date: string | null;
  deposit: number | null;
  monthly_rent: number | null;
  maintenance_fee: number | null;
  vat_amount: number | null;
  vat_note: string | null;
  pay_day: number | null;
  contract_period_text: string | null;
  special_terms: string | null;
  is_renewal: boolean | null;
  confidence_notes: string | null;
};

const PERIODS = [12, 24, 36, 60];

/**
 * 계약 등록/수정. 새 계약은 위에서 계약서(PDF/JPG/PNG)를 올리면 AI 가 칸을 채워준다.
 * AI 가 채운 경우 '확인했습니다' 체크를 해야 저장된다.
 */
export default function ContractForm({
  action,
  sections,
  initial,
  edit,
  cancelHref,
}: {
  action: (p: FormState, fd: FormData) => Promise<FormState>;
  sections: Section[];
  initial: Values;
  edit: boolean;
  cancelHref: string;
}) {
  const [values, setValues] = useState<Values>(() => normalize(initial, sections));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ error?: string; info?: string }>({});
  const [ocr, setOcr] = useState<{ json: string; docId: string; x: Extraction | null } | null>(null);
  const [docId, setDocId] = useState("");
  const [reviewed, setReviewed] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  async function upload(original: File) {
    setBusy(true);
    setNote(null);
    let file: File;
    try {
      const r = await prepareUpload(original, (m) => setMsg({ info: m }));
      file = r.file;
      setNote(r.note);
    } catch (e) {
      setBusy(false);
      return setMsg({ error: e instanceof Error ? e.message : String(e) });
    }
    setMsg({ info: "AI 가 계약서를 읽고 있습니다... (20초~1분)" });
    const fd = new FormData();
    fd.set("file", file);
    const r = await fetch("/api/ocr", { method: "POST", body: fd });
    const j = await r.json().catch(() => ({ error: `업로드 실패 (${r.status})` }));
    setBusy(false);
    if (j.documentId) setDocId(j.documentId);
    if (!j.extraction) return setMsg({ error: j.error ?? "추출 실패" });
    const x = j.extraction as Extraction;
    const next: Values = { ...values };
    const set = (k: string, v: unknown) => {
      if (v !== null && v !== undefined && v !== "") next[k] = typeof v === "number" ? v.toLocaleString("ko-KR") : (v as string | boolean);
    };
    set("landlord_name", x.landlord_name);
    set("contract_date", x.contract_date);
    set("start_date", x.start_date);
    set("end_date", x.end_date);
    set("deposit", x.deposit);
    set("monthly_rent", x.monthly_rent);
    set("maintenance_fee", x.maintenance_fee);
    set("vat_amount", x.vat_amount);
    if (x.pay_day) next.pay_day = String(x.pay_day);
    set("special_terms", x.special_terms);
    if (x.is_renewal != null) next.is_renewal = x.is_renewal;
    if (j.match?.unit_id) next.unit_id = j.match.unit_id;
    if (j.match?.tenant_id) {
      next.tenant_id = j.match.tenant_id;
    } else if (x.tenant_name) {
      next.tenant_id = "";
      set("new_tenant_name", x.tenant_name);
      set("new_tenant_phone", x.tenant_phone);
      set("new_tenant_biz_no", x.tenant_biz_no);
    }
    setValues(next);
    setOcr({ json: JSON.stringify(x), docId: j.documentId, x });
    setReviewed(false);
    setMsg({});
  }

  function applyPeriod(months: number) {
    const start = String(values.start_date || "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(start)) return setMsg({ error: "시작일을 먼저 입력하세요." });
    const [y, m, d] = start.split("-").map(Number);
    const end = new Date(Date.UTC(y, m - 1 + months, d - 1));
    setValues((v) => ({ ...v, end_date: end.toISOString().slice(0, 10) }));
    setMsg({});
  }

  return (
    <div className="space-y-4">
      {!edit && (
        <div className="rounded-2xl border-2 border-dashed border-navy-200 bg-navy-50/50 p-4">
          <div className="text-sm font-bold text-navy-900">📄 임대차계약서 올리기 (AI 자동 입력)</div>
          <p className="mt-1 text-xs text-slate-600">PDF·JPG·PNG 계약서(최대 1GB)를 올리면 임대인·임차인·연락처·사업자번호·주소·호실·계약일·기간·보증금·월세·관리비·부가세·납부일·특약사항을 자동으로 채웁니다. 계약서는 문서함에 함께 저장됩니다. 4MB가 넘는 파일은 올리기 전에 자동으로 줄입니다 (PDF는 앞 50쪽까지).</p>
          <input
            type="file"
            accept="application/pdf,image/jpeg,image/png,image/webp"
            className="input mt-3 !bg-white !py-1.5"
            disabled={busy}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) upload(f);
            }}
          />
          {msg.info && <p className="mt-2 animate-pulse text-sm text-navy-700">{msg.info}</p>}
          {note && !msg.info && <p className="mt-2 text-xs text-slate-600">ℹ️ {note}</p>}
          {msg.error && <p className="mt-2 text-sm text-red-600">{msg.error}</p>}
        </div>
      )}

      {ocr && (
        <div className="rounded-2xl bg-amber-50 p-4 ring-1 ring-amber-300">
          <div className="text-base font-bold text-amber-900">⚠️ AI가 추출한 계약정보입니다. 저장하기 전에 확인해주세요.</div>
          <p className="mt-1 text-sm text-amber-800">AI 는 잘못 읽을 수 있습니다. 특히 금액·날짜·호실·임차인을 계약서 원본과 비교해 주세요.</p>
          <div className="mt-2 grid gap-1 text-xs text-amber-900 sm:grid-cols-2">
            {ocr.x?.property_description && <div>목적물: {ocr.x.property_description}</div>}
            {ocr.x?.address && <div>주소: {ocr.x.address} {ocr.x.unit_no}</div>}
            {ocr.x?.contract_period_text && <div>계약기간: {ocr.x.contract_period_text}</div>}
            {ocr.x?.vat_note && <div>부가세: {ocr.x.vat_note}</div>}
            {ocr.x?.confidence_notes && <div className="sm:col-span-2">확인 필요: {ocr.x.confidence_notes}</div>}
          </div>
          <a href={`/api/documents/${ocr.docId}`} target="_blank" rel="noreferrer" className="link mt-2 inline-block text-sm">
            계약서 원본 보기 ↗
          </a>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
        계약기간 빠른 입력:
        {PERIODS.map((m) => (
          <button key={m} type="button" className="rounded-md bg-slate-100 px-2 py-1 font-medium text-slate-700 hover:bg-slate-200" onClick={() => applyPeriod(m)}>
            {m >= 12 && m % 12 === 0 ? `${m / 12}년` : `${m}개월`}
          </button>
        ))}
      </div>

      <SmartForm action={action} sections={sections} initial={initial} values={values} onValuesChange={setValues} submitLabel={edit ? "저장" : "계약 등록"} cancelHref={cancelHref}>
        <input type="hidden" name="ocr_document_id" value={ocr?.docId ?? docId} />
        {ocr && (
          <>
            <input type="hidden" name="ocr_json" value={ocr.json} />
            <label className="flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-3 text-sm font-semibold text-amber-900 ring-1 ring-amber-300">
              <input type="checkbox" name="ocr_reviewed" required className="size-5 accent-amber-600" checked={reviewed} onChange={(e) => setReviewed(e.target.checked)} />
              AI 추출 내용을 계약서 원본과 비교해 확인했습니다
            </label>
          </>
        )}
      </SmartForm>
    </div>
  );
}
