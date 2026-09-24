"use client";
import Link from "next/link";
import Papa from "papaparse";
import { useMemo, useState, useTransition } from "react";
import {
  FIELDS,
  findHeaderRow,
  guessMapping,
  parseRows,
  type Cell,
  type ColumnMapping,
  type FieldKey,
} from "@/lib/kkday/parse";
import { saveBookings, type SaveResult } from "./actions";

async function readFile(file: File): Promise<Cell[][]> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".csv") || name.endsWith(".txt")) {
    const buf = await file.arrayBuffer();
    // UTF-8 이 깨지면 EUC-KR 로 다시 읽는다 (한국 엑셀에서 저장한 CSV)
    let text = new TextDecoder("utf-8").decode(buf);
    if (text.includes("�")) text = new TextDecoder("euc-kr").decode(buf);
    const res = Papa.parse<string[]>(text.replace(/^﻿/, ""), { skipEmptyLines: false });
    return res.data;
  }
  if (name.endsWith(".xlsx")) {
    const { default: readXlsxFile } = await import("read-excel-file/browser");
    const sheets = await readXlsxFile(file);
    // 데이터가 가장 많은 시트 사용
    const best = sheets.reduce((a, b) => (b.data.length > a.data.length ? b : a), sheets[0]);
    return (best?.data ?? []) as Cell[][];
  }
  throw new Error("xlsx 또는 csv 파일만 지원합니다. (xls 는 엑셀에서 xlsx 로 다시 저장해주세요)");
}

export function UploadClient() {
  const [filename, setFilename] = useState("");
  const [rows, setRows] = useState<Cell[][]>([]);
  const [headerRow, setHeaderRow] = useState(0);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [fallbackDate, setFallbackDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SaveResult | null>(null);
  const [pending, startTransition] = useTransition();

  const headers = useMemo(() => (rows[headerRow] ?? []).map((c) => String(c ?? "").trim()), [rows, headerRow]);
  const parsed = useMemo(
    () => (rows.length ? parseRows(rows, headerRow, mapping, { fallbackDate: fallbackDate || undefined }) : []),
    [rows, headerRow, mapping, fallbackDate],
  );
  const warnCount = parsed.filter((p) => p.warnings.length).length;

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setResult(null);
    try {
      const data = await readFile(file);
      const h = findHeaderRow(data);
      setFilename(file.name);
      setRows(data);
      setHeaderRow(h);
      setMapping(guessMapping((data[h] ?? []).map((c) => String(c ?? ""))));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  function setField(key: FieldKey, value: string) {
    setMapping((m) => {
      const next = { ...m };
      if (value === "") delete next[key];
      else next[key] = Number(value);
      return next;
    });
  }

  function onSave() {
    startTransition(async () => {
      setResult(await saveBookings(filename, parsed));
    });
  }

  return (
    <div className="space-y-6">
      <div className="card space-y-3">
        <p className="text-sm text-gray-600">
          KKday 파트너 센터에서 내려받은 주문/일정 엑셀(xlsx) 또는 CSV 파일을 올려주세요. 컬럼은 자동 인식되며, 아래에서 직접 바꿀 수 있습니다.
        </p>
        <input type="file" accept=".xlsx,.csv,.txt" onChange={onFile} className="block text-sm" />
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>

      {rows.length > 0 && (
        <>
          <div className="card space-y-4">
            <div className="flex flex-wrap items-end gap-4">
              <div>
                <label className="label">헤더 행</label>
                <select className="input" value={headerRow} onChange={(e) => {
                  const h = Number(e.target.value);
                  setHeaderRow(h);
                  setMapping(guessMapping((rows[h] ?? []).map((c) => String(c ?? ""))));
                }}>
                  {rows.slice(0, 10).map((r, i) => (
                    <option key={i} value={i}>{i + 1}행: {r.filter(Boolean).slice(0, 3).map(String).join(", ")}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">이용일 기본값 (파일에 날짜가 없을 때)</label>
                <input type="date" className="input" value={fallbackDate} onChange={(e) => setFallbackDate(e.target.value)} />
              </div>
            </div>
            <h2 className="font-semibold">컬럼 매핑</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {(Object.keys(FIELDS) as FieldKey[]).map((key) => (
                <div key={key}>
                  <label className="label">{FIELDS[key]}</label>
                  <select className="input" value={mapping[key] ?? ""} onChange={(e) => setField(key, e.target.value)}>
                    <option value="">(없음)</option>
                    {headers.map((h, i) => (
                      <option key={i} value={i}>{h || `${i + 1}열`}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>

          <div className="card space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="font-semibold">미리보기 ({parsed.length}건{warnCount ? `, 확인 필요 ${warnCount}건` : ""})</h2>
              <button className="btn ml-auto" onClick={onSave} disabled={pending || parsed.length === 0}>
                {pending ? "저장 중..." : `${parsed.length}건 저장`}
              </button>
            </div>
            {result?.ok === false && <p className="text-sm text-red-600">{result.error}</p>}
            {result?.ok && (
              <p className="rounded-lg bg-green-50 p-3 text-sm text-green-800">
                {result.count}건 저장 완료.{" "}
                {result.dates.map((d) => (
                  <Link key={d} href={`/admin/dispatch?date=${d}`} className="mr-2 font-medium text-blue-700 underline">{d} 배차하기</Link>
                ))}
              </p>
            )}
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr><th>행</th><th>예약번호</th><th>이용일</th><th>픽업</th><th>인원</th><th>상품</th><th>고객</th><th>픽업장소</th><th>하차장소</th><th>소요</th><th>확인</th></tr>
                </thead>
                <tbody>
                  {parsed.slice(0, 200).map((p) => (
                    <tr key={p.rowIndex} className={p.warnings.length ? "bg-amber-50" : ""}>
                      <td>{p.rowIndex}</td>
                      <td>{p.bookingNo}</td>
                      <td>{p.serviceDate}</td>
                      <td>{p.pickupAt?.slice(11, 16) ?? "-"}</td>
                      <td>{p.pax}</td>
                      <td className="max-w-48 truncate" title={p.productName ?? ""}>{p.productName}</td>
                      <td>{p.customerName}</td>
                      <td className="max-w-48 truncate" title={p.pickupAddress ?? ""}>{p.pickupAddress}</td>
                      <td className="max-w-48 truncate" title={p.dropoffAddress ?? ""}>{p.dropoffAddress}</td>
                      <td>{p.durationMin ? `${p.durationMin}분` : "기본"}</td>
                      <td className="text-xs text-amber-700">{p.warnings.join(" / ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {parsed.length > 200 && <p className="mt-2 text-sm text-gray-500">처음 200건만 표시합니다.</p>}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
