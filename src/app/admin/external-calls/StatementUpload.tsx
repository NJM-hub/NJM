"use client";
import Papa from "papaparse";
import { useState, useTransition } from "react";
import { parseKkdayStatement } from "@/lib/kkday/statement";
import { saveKkdayStatement, type StatementSaveResult } from "./actions";

type Cell = string | number | Date | boolean | null;

async function readRows(file: File): Promise<Cell[][]> {
  if (/\.(xlsx|xls)$/i.test(file.name)) {
    const { default: readXlsxFile } = await import("read-excel-file/browser");
    const sheets = await readXlsxFile(file);
    return sheets.flatMap((s) => s.data as Cell[][]);
  }
  const buf = await file.arrayBuffer();
  let text = new TextDecoder("utf-8").decode(buf);
  if (text.includes("�")) text = new TextDecoder("euc-kr").decode(buf);
  return Papa.parse<string[]>(text.replace(/^﻿/, ""), { skipEmptyLines: true }).data;
}

/** KKday 정산내역서 올리기 → 예약번호별 금액 저장 */
export function StatementUpload() {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<StatementSaveResult | null>(null);

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setResult(null);
    start(async () => {
      try {
        setResult(await saveKkdayStatement(parseKkdayStatement(await readRows(file))));
      } catch (err) {
        setResult({ ok: false, error: err instanceof Error ? err.message : String(err) });
      }
      e.target.value = "";
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-3 text-sm">
      <label className="btn-secondary cursor-pointer">
        {pending ? "불러오는 중..." : "KKday 정산내역서 올리기 (CSV/엑셀)"}
        <input type="file" accept=".csv,.xlsx,.xls,.txt" className="hidden" onChange={onFile} disabled={pending} />
      </label>
      {result?.ok && <span className="text-green-700">예약 {result.count}건을 저장했습니다. 아래 건별 차액에 반영됩니다.</span>}
      {result && !result.ok && <span className="text-red-600">{result.error}</span>}
    </div>
  );
}
