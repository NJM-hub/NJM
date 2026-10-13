"use client";
import Papa from "papaparse";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { Cell, ParsedBooking } from "@/lib/kkday/parse";
import { isKkdayScm, parseKkdayScm } from "@/lib/kkday/scm";
import { saveBookings } from "../upload/actions";

type Parsed = { filename: string; bookings: ParsedBooking[]; cancelled: number; byDate: [string, number][] };

async function readRows(file: File): Promise<Cell[][][]> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".csv") || name.endsWith(".txt")) {
    const buf = await file.arrayBuffer();
    // UTF-8 이 깨지면 EUC-KR 로 다시 읽는다 (한국 엑셀에서 저장한 CSV)
    let text = new TextDecoder("utf-8").decode(buf);
    if (text.includes("�")) text = new TextDecoder("euc-kr").decode(buf);
    return [Papa.parse<string[]>(text.replace(/^﻿/, ""), { skipEmptyLines: false }).data];
  }
  if (name.endsWith(".xlsx")) {
    const { default: readXlsxFile } = await import("read-excel-file/browser");
    return (await readXlsxFile(file)).map((s) => s.data as Cell[][]);
  }
  throw new Error("xlsx 또는 csv 파일만 지원합니다. (xls 는 엑셀에서 xlsx 로 다시 저장해주세요)");
}

/** KKday 공급사 주문 내보내기(OrderExport) 파일을 골라 예약으로 저장한다. 저장 후 자동 배차를 돌리면 된다 */
export function KkdayFileUpload({ date }: { date: string }) {
  const router = useRouter();
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [pending, start] = useTransition();

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    setParsed(null);
    setError(null);
    setDone(null);
    if (!file) return;
    try {
      for (const rows of await readRows(file)) {
        const h = rows.slice(0, 20).findIndex((r) => isKkdayScm(r));
        if (h < 0) continue;
        const { bookings, cancelled } = parseKkdayScm(rows, h);
        const count = new Map<string, number>();
        for (const b of bookings) if (b.serviceDate) count.set(b.serviceDate, (count.get(b.serviceDate) ?? 0) + 1);
        setParsed({ filename: file.name, bookings, cancelled, byDate: [...count].sort((a, b) => a[0].localeCompare(b[0])) });
        return;
      }
      setError("KKday 주문 내보내기 파일이 아닙니다. (주문 번호·여정 유형·이용 시간·위치 이름 열이 필요합니다)");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  function save() {
    if (!parsed) return;
    start(async () => {
      const res = await saveBookings(parsed.filename, parsed.bookings);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setParsed(null);
      setDone(`예약 ${res.count}건을 저장했습니다 (${res.dates.join(", ")}). 아래에서 자동 배차를 실행하세요.`);
      const target = res.dates.includes(date) ? date : res.dates[0];
      router.push(`/admin/dispatch?date=${target}`);
      router.refresh();
    });
  }

  return (
    <div className="space-y-2 border-t border-gray-100 pt-4 text-sm">
      <div className="flex flex-wrap items-center gap-3">
        <span className="font-medium text-gray-700">KKday 예약 파일</span>
        <label className="btn-secondary cursor-pointer">
          파일 선택 (xlsx/csv)
          <input type="file" accept=".xlsx,.csv,.txt" className="hidden" onChange={onFile} disabled={pending} />
        </label>
        <span className="text-xs text-gray-500">KKday 공급사 주문 내보내기(OrderExport) 파일을 올리면 예약으로 저장됩니다.</span>
      </div>
      {parsed && (
        <div className="rounded border border-violet-200 bg-violet-50 p-3">
          <div>
            <b>{parsed.filename}</b>: 유효 예약 {parsed.bookings.length}건
            {parsed.cancelled > 0 && <>, 취소 {parsed.cancelled}건 제외</>}
          </div>
          <div className="mt-1 text-gray-600">
            {parsed.byDate.map(([d, n]) => (
              <span key={d} className={`mr-3 ${d === date ? "font-semibold text-violet-800" : ""}`}>{d.slice(5)} {n}건</span>
            ))}
          </div>
          <div className="mt-2 flex gap-2">
            <button type="button" className="btn" onClick={save} disabled={pending || !parsed.bookings.length}>
              {pending ? "저장 중…" : "예약 저장"}
            </button>
            <button type="button" className="btn-secondary" onClick={() => setParsed(null)} disabled={pending}>취소</button>
          </div>
          <p className="mt-1 text-xs text-gray-500">같은 예약번호·이용일이 이미 있으면 파일 내용으로 바뀝니다.</p>
        </div>
      )}
      {error && <div className="text-red-600">{error}</div>}
      {done && <div className="text-green-700">{done}</div>}
    </div>
  );
}
