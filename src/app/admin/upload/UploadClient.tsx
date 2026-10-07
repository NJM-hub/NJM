"use client";
import { ko } from "@/lib/ko";
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
import { tripLabel } from "@/lib/format";
import { isKkdayScm, parseKkdayScm } from "@/lib/kkday/scm";
import { findDispatchSheetHeader, parseDispatchSheet } from "@/lib/kkday/sheet";
import { importSheetDispatch, type SheetImportResult } from "../dispatch/actions";
import { fetchGoogleSheet, saveBookings, type SaveResult } from "./actions";

type Sheet = { name: string; data: Cell[][] };

async function readXlsx(file: Blob): Promise<Sheet[]> {
  const { default: readXlsxFile } = await import("read-excel-file/browser");
  const sheets = await readXlsxFile(file);
  return sheets.map((x) => ({ name: x.sheet, data: x.data as Cell[][] }));
}

type BatchItem = { sheet: string; date: string | null; result: SheetImportResult | null };

async function readFile(file: File): Promise<Sheet[]> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".csv") || name.endsWith(".txt")) {
    const buf = await file.arrayBuffer();
    // UTF-8 이 깨지면 EUC-KR 로 다시 읽는다 (한국 엑셀에서 저장한 CSV)
    let text = new TextDecoder("utf-8").decode(buf);
    if (text.includes("�")) text = new TextDecoder("euc-kr").decode(buf);
    const res = Papa.parse<string[]>(text.replace(/^﻿/, ""), { skipEmptyLines: false });
    return [{ name: file.name, data: res.data }];
  }
  if (name.endsWith(".xlsx")) return readXlsx(file);
  throw new Error("xlsx 또는 csv 파일만 지원합니다. (xls 는 엑셀에서 xlsx 로 다시 저장해주세요)");
}

export function UploadClient() {
  const [filename, setFilename] = useState("");
  const [sheets, setSheets] = useState<Sheet[]>([]);
  const [sheetIndex, setSheetIndex] = useState(0);
  const [sheetUrl, setSheetUrl] = useState("");
  const [allTabs, setAllTabs] = useState(true);
  const [batch, setBatch] = useState<BatchItem[]>([]);
  const [rows, setRows] = useState<Cell[][]>([]);
  const [headerRow, setHeaderRow] = useState(0);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [fallbackDate, setFallbackDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SaveResult | null>(null);
  const [sheetResult, setSheetResult] = useState<SheetImportResult | null>(null);
  const [pending, startTransition] = useTransition();

  const headers = useMemo(() => (rows[headerRow] ?? []).map((c) => String(c ?? "").trim()), [rows, headerRow]);
  // 구글 시트 배차표(기사 칸 포함)는 헤더 행을 따로 찾는다
  const sheetHeader = useMemo(() => findDispatchSheetHeader(rows), [rows]);
  const dispatchSheet = useMemo(() => (sheetHeader >= 0 ? parseDispatchSheet(rows, sheetHeader) : null), [rows, sheetHeader]);
  const scm = useMemo(() => !dispatchSheet && rows.length > 0 && isKkdayScm(rows[headerRow] ?? []), [dispatchSheet, rows, headerRow]);
  const scmResult = useMemo(() => (scm ? parseKkdayScm(rows, headerRow) : null), [scm, rows, headerRow]);
  const parsed = useMemo(
    () =>
      dispatchSheet?.bookings ??
      scmResult?.bookings ??
      (rows.length ? parseRows(rows, headerRow, mapping, { fallbackDate: fallbackDate || undefined }) : []),
    [dispatchSheet, scmResult, rows, headerRow, mapping, fallbackDate],
  );
  const sheetStats = useMemo(() => {
    if (!dispatchSheet) return null;
    const list = dispatchSheet.bookings;
    const vehicles = new Set(list.flatMap((b) => (b.sheetDriver?.kind === "vehicle" ? [b.sheetDriver.label] : [])));
    return {
      vehicles: [...vehicles],
      assigned: list.filter((b) => b.sheetDriver?.kind === "vehicle").length,
      external: list.filter((b) => b.sheetDriver?.kind === "external").length,
      empty: list.filter((b) => !b.sheetDriver).length,
    };
  }, [dispatchSheet]);
  const warnCount = parsed.filter((p) => p.warnings.length).length;

  function selectSheet(list: Sheet[], index: number, name: string) {
    const data = list[index]?.data ?? [];
    const h = findHeaderRow(data);
    setFilename(list.length > 1 ? `${name} [${list[index]?.name}]` : name);
    setSheets(list);
    setSheetIndex(index);
    setRows(data);
    setHeaderRow(h);
    setMapping(guessMapping((data[h] ?? []).map((c) => String(c ?? ""))));
    setResult(null);
    setSheetResult(null);
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    try {
      const list = await readFile(file);
      // 배차표 형식 시트가 있으면 그 시트, 없으면 데이터가 가장 많은 시트
      const sheetIdx = list.findIndex((x) => findDispatchSheetHeader(x.data) >= 0);
      const biggest = list.reduce((best, x, i) => (x.data.length > list[best].data.length ? i : best), 0);
      selectSheet(list, sheetIdx >= 0 ? sheetIdx : biggest, file.name);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  function onSheetUrl() {
    setError(null);
    startTransition(async () => {
      const res = await fetchGoogleSheet(sheetUrl.trim(), allTabs);
      if (!res.ok) return setError(res.error);
      if ("rows" in res) return selectSheet([{ name: res.name, data: res.rows }], 0, res.name);
      const bytes = Uint8Array.from(atob(res.xlsxBase64), (c) => c.charCodeAt(0));
      const list = await readXlsx(new Blob([bytes]));
      // 링크의 탭(gid)은 알 수 없으므로 배차표 형식의 마지막 탭(최근 날짜)을 먼저 보여준다
      const last = list.findLastIndex((x) => findDispatchSheetHeader(x.data) >= 0);
      selectSheet(list, last >= 0 ? last : 0, res.name);
    });
  }

  /** 배차표 형식의 모든 탭(날짜)을 차례로 저장 */
  const dispatchTabs = useMemo(
    () => sheets.flatMap((x) => {
      const h = findDispatchSheetHeader(x.data);
      if (h < 0) return [];
      const p = parseDispatchSheet(x.data, h);
      return p.bookings.length ? [{ name: x.name, parsed: p }] : [];
    }),
    [sheets],
  );

  function onSaveAll() {
    const base = filename.replace(/ \[.*\]$/, "");
    const items: BatchItem[] = dispatchTabs.map((t) => ({ sheet: t.name, date: t.parsed.bookings[0]?.serviceDate ?? null, result: null }));
    setBatch(items);
    startTransition(async () => {
      for (const [i, t] of dispatchTabs.entries()) {
        const result = await importSheetDispatch(`${base} [${t.name}]`, [...t.parsed.bookings, ...t.parsed.ownCalls], t.parsed.cancelled.map((x) => x.bookingNo));
        items[i] = { ...items[i], result };
        setBatch([...items]);
      }
    });
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
      if (dispatchSheet) setSheetResult(await importSheetDispatch(filename, [...dispatchSheet.bookings, ...dispatchSheet.ownCalls], dispatchSheet.cancelled.map((x) => x.bookingNo)));
      else setResult(await saveBookings(filename, parsed));
    });
  }

  return (
    <div className="space-y-6">
      <div className="card space-y-3">
        <p className="text-sm text-gray-600">
          KKday 파트너 센터에서 내려받은 주문/일정 엑셀(xlsx) 또는 CSV 파일을 올려주세요. 컬럼은 자동 인식되며, 아래에서 직접 바꿀 수 있습니다.
        </p>
        <input type="file" accept=".xlsx,.csv,.txt" onChange={onFile} className="block text-sm" />
        <div className="flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3">
          <input
            type="url"
            value={sheetUrl}
            onChange={(e) => setSheetUrl(e.target.value)}
            placeholder="또는 구글 시트 링크 붙여넣기 (https://docs.google.com/spreadsheets/d/...#gid=...)"
            className="input min-w-0 flex-1"
          />
          <label className="flex items-center gap-1 text-sm">
            <input type="checkbox" checked={allTabs} onChange={(e) => setAllTabs(e.target.checked)} /> 모든 탭(날짜)
          </label>
          <button className="btn-secondary" onClick={onSheetUrl} disabled={pending || !sheetUrl.trim()}>
            {pending && !rows.length ? "불러오는 중..." : "시트 불러오기"}
          </button>
        </div>
        <p className="text-xs text-gray-500">
          &quot;모든 탭&quot;을 켜면 날짜별 탭을 전부 불러오고, 끄면 링크의 탭(gid) 하나만 불러옵니다. 공유 설정이 &quot;링크가 있는 모든 사용자&quot;여야 합니다.
        </p>
        {sheets.length > 1 && (
          <div>
            <label className="label">시트 선택</label>
            <select className="input" value={sheetIndex} onChange={(e) => selectSheet(sheets, Number(e.target.value), filename.replace(/ \[.*\]$/, ""))}>
              {sheets.map((x, i) => (
                <option key={i} value={i}>{x.name} ({x.data.length}행)</option>
              ))}
            </select>
          </div>
        )}
        {dispatchTabs.length > 1 && (
          <div className="rounded-lg border border-violet-200 bg-violet-50 p-3 text-sm">
            <div className="flex flex-wrap items-center gap-3">
              <span>배차 시트 형식의 탭 <b>{dispatchTabs.length}개</b> (날짜별)</span>
              <button className="btn ml-auto" onClick={onSaveAll} disabled={pending}>
                {pending && batch.length ? `저장 중... (${batch.filter((b) => b.result).length}/${batch.length})` : `${dispatchTabs.length}개 탭 모두 저장 + 배차 확정`}
              </button>
            </div>
            {batch.length > 0 && (
              <ul className="mt-2 space-y-0.5">
                {batch.map((b) => (
                  <li key={b.sheet}>
                    <span className="inline-block w-20">{b.sheet}</span>
                    {b.date && <Link href={`/admin/dispatch?date=${b.date}`} className="mr-2 text-blue-700 underline">{b.date}</Link>}
                    {!b.result ? <span className="text-gray-400">대기</span>
                      : b.result.ok ? <span className="text-green-700">예약 {b.result.count}건 · 배차 {b.result.assigned} · 외부 {b.result.external} · 자체 콜 {b.result.ownCalls}{b.result.vehiclesCreated.length ? ` · 새 차량 ${b.result.vehiclesCreated.join(", ")}` : ""}</span>
                      : <span className="text-red-600">{b.result.error}</span>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>

      {dispatchSheet && sheetStats && (
        <div className="card border-violet-200 bg-violet-50 text-sm text-violet-900">
          <b>배차 시트</b>(기사 칸 포함) 형식으로 인식했습니다. 예약 {dispatchSheet.bookings.length}건
          {dispatchSheet.skipped > 0 && <>, 표 아래 메모 등 {dispatchSheet.skipped}행은 제외</>}.
          <ul className="mt-2 list-disc space-y-0.5 pl-5">
            <li>차량 배차 {sheetStats.assigned}건 · 차량 {sheetStats.vehicles.length}대: {sheetStats.vehicles.map((x) => ko(x)).join(", ")}</li>
            <li>외부(타업체) 배차 {sheetStats.external}건 (기사 칸에 금액만 있는 건)</li>
            {sheetStats.empty > 0 && <li className="text-amber-700">기사 칸이 빈 건 {sheetStats.empty}건은 미배정으로 둡니다</li>}
            <li>
              기사 자체 콜(표 아래 기사별 칸) {dispatchSheet.ownCalls.length}건 — 해당 기사 차량에 고정하고 정산에서는 제외합니다
              {dispatchSheet.ownCalls.length > 0 && (
                <ul className="mt-1 list-none space-y-0.5 pl-0 text-xs">
                  {dispatchSheet.ownCalls.map((c) => (
                    <li key={c.bookingNo}>
                      <b className="inline-block w-24">{ko(c.sheetDriver?.label)}</b>
                      <span className="inline-block w-12">{c.pickupAt?.slice(11, 16) ?? "시간?"}</span>
                      {c.tripType && <span className="mr-1 text-violet-700">[{c.tripType}]</span>}
                      {c.memo}
                    </li>
                  ))}
                </ul>
              )}
            </li>
            {dispatchSheet.cancelled.length > 0 && (
              <li>
                취소 표시된 예약 {dispatchSheet.cancelled.length}건은 제외(전산에 있으면 삭제):{" "}
                {dispatchSheet.cancelled.map((x) => `${x.bookingNo} (${x.text.trim()})`).join(", ")}
              </li>
            )}
            {dispatchSheet.unparsed.length > 0 && (
              <li className="text-amber-700">
                시간을 읽지 못해 빠지는 행 {dispatchSheet.unparsed.length}건 (시트에서 고친 뒤 다시 불러오세요):
                {dispatchSheet.unparsed.map((u) => <div key={u.rowIndex} className="text-xs">{u.rowIndex}행: {u.text}</div>)}
              </li>
            )}
            {dispatchSheet.notes.length > 0 && (
              <li className="text-gray-600">기사 메모(콜 아님): {dispatchSheet.notes.map((n) => `${n.driver} ${n.text}`).join(", ")}</li>
            )}
          </ul>
          <p className="mt-2">
            저장하면 예약을 등록하고, 차량번호 뒤 4자리로 등록 차량을 찾아(없으면 새로 등록) <b>시트와 똑같이 배차를 확정</b>합니다.
          </p>
        </div>
      )}

      {scmResult && (
        <div className="card border-blue-200 bg-blue-50 text-sm text-blue-900">
          <b>KKday 공급사 주문 내보내기</b> 형식으로 인식했습니다. 유효 {scmResult.bookings.length}건
          {scmResult.cancelled > 0 && <>, 취소 {scmResult.cancelled}건은 제외</>}.
          이용 시간을 도착 시각으로, 최종 픽업 시간까지를 대기 시간으로 계산하고 예약 차급(인승·등급)에 맞는 차량만 배정합니다.
        </div>
      )}

      {rows.length > 0 && (
        <>
          <div className={`card space-y-4 ${scm || dispatchSheet ? "hidden" : ""}`}>
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
                {pending ? "저장 중..." : dispatchSheet ? `${parsed.length + dispatchSheet.ownCalls.length}건 저장 + 시트대로 배차 확정` : `${parsed.length}건 저장`}
              </button>
            </div>
            {result?.ok === false && <p className="text-sm text-red-600">{result.error}</p>}
            {sheetResult?.ok === false && <p className="text-sm text-red-600">{sheetResult.error}</p>}
            {sheetResult?.ok && (
              <div className="rounded-lg bg-green-50 p-3 text-sm text-green-800">
                예약 {sheetResult.count}건 저장, 차량 배차 {sheetResult.assigned}건(자체 콜 {sheetResult.ownCalls}건 포함) · 외부 {sheetResult.external}건
                {sheetResult.unassigned > 0 && ` · 미배정 ${sheetResult.unassigned}건`} 으로 확정했습니다.
                {sheetResult.vehiclesCreated.length > 0 && (
                  <div className="mt-1">
                    새로 등록한 차량: {sheetResult.vehiclesCreated.join(", ")} —{" "}
                    <Link href="/admin/vehicles" className="font-medium text-blue-700 underline">차량 관리</Link>에서 전체 차량번호·차종을 확인하세요.
                  </div>
                )}
                <div className="mt-1">
                  {sheetResult.dates.map((d) => (
                    <Link key={d} href={`/admin/dispatch?date=${d}`} className="mr-2 font-medium text-blue-700 underline">{d} 배차 보기</Link>
                  ))}
                </div>
              </div>
            )}
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
                  <tr><th>행</th>{dispatchSheet && <th>기사</th>}<th>예약번호</th><th>이용일</th><th>도착</th><th>인원</th><th>상품/차급</th><th>고객·항공편</th><th>픽업장소</th><th>하차장소</th><th>대기/소요</th><th>확인</th></tr>
                </thead>
                <tbody>
                  {parsed.slice(0, 200).map((p) => (
                    <tr key={p.rowIndex} className={p.warnings.length ? "bg-amber-50" : ""}>
                      <td>{p.rowIndex}</td>
                      {dispatchSheet && (
                        <td className="whitespace-nowrap">
                          {(() => {
                            const d = dispatchSheet.bookings.find((b) => b.rowIndex === p.rowIndex)?.sheetDriver;
                            if (!d) return <span className="text-amber-700">미배정</span>;
                            return d.kind === "external" ? <span className="badge bg-gray-100 text-gray-700">외부 {d.fare.toLocaleString("ko-KR")}</span> : ko(d.label);
                          })()}
                        </td>
                      )}
                      <td>{p.bookingNo}</td>
                      <td>{p.serviceDate}</td>
                      <td>{p.pickupAt?.slice(11, 16) ?? "-"}</td>
                      <td>{p.pax}</td>
                      <td className="max-w-48 truncate" title={p.productName ?? ""}>
                        {tripLabel(p.tripType) && <span className={`badge mr-1 ${tripLabel(p.tripType)!.className}`}>{tripLabel(p.tripType)!.label}</span>}
                        {p.vehicleClass ?? p.productName}
                      </td>
                      <td>{p.customerName ?? p.flightNo}</td>
                      <td className="max-w-48 truncate" title={p.pickupAddress ?? ""}>{p.pickupPlace ?? p.pickupAddress}</td>
                      <td className="max-w-48 truncate" title={p.dropoffAddress ?? ""}>{p.dropoffPlace ?? p.dropoffAddress}</td>
                      <td>{p.waitMin != null ? `대기 ${p.waitMin}분` : p.durationMin ? `${p.durationMin}분` : "기본"}</td>
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
