import Link from "next/link";
import { requireOwner } from "@/lib/auth";
import { fmtTime, isMonth, todayKst, won } from "@/lib/format";
import { SubmitButton } from "@/components/SubmitButton";
import { loadVehicleMonth, type VehicleMonthReport } from "@/lib/settlement/vehicleMonthlyLoad";
import { EXPENSE_LABELS, inOutLabel, kkdayDiffOf, kkdayTotals, OWN_CALL, tripKind, type DayCount } from "@/lib/settlement/vehicleMonthly";
import {
  addManualItem, deleteManualItem, deleteSelectedRows, deleteVehicleMonth, deleteVehicleMonthQuick, deleteWholeMonth, resetVehicleSettlement,
  saveAmounts, saveExpenses, setSettlementStatus,
} from "./actions";
import { SelectAll } from "./SelectAll";

const WEEKDAY = ["일", "월", "화", "수", "목", "금", "토"];

/** "2026-09-01" → "9월 1일 (화)" */
function dayLabel(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return `${m}월 ${d}일 (${WEEKDAY[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]})`;
}

/** "9754 车秀荣" */
function vehicleTitle(plate: string, driverName: string | null): string {
  return [plate, driverName].filter(Boolean).join(" ");
}

const num = (n: number) => (n ? n.toLocaleString("ko-KR") : "-");
/** 차액 표시: 마이너스는 빨간 -, 없으면 - */
const diffCell = (n: number | null | undefined) =>
  n == null ? <span className="text-gray-400">-</span> : <span className={n < 0 ? "text-red-600" : "text-gray-900"}>{won(n)}</span>;

/** 건별 내역의 고칠 수 있는 칸: 원래 값(o_)과 함께 보내 바뀐 것만 저장한다 */
function Editable({ id, f, value, type = "text", className = "", placeholder }: {
  id: string; f: string; value: string | number | null | undefined; type?: string; className?: string; placeholder?: string;
}) {
  const v = value ?? "";
  return (
    <>
      <input type="hidden" name={`o_${f}_${id}`} value={v} />
      <input name={`f_${f}_${id}`} type={type} defaultValue={v} placeholder={placeholder} className={`input !py-1 text-xs ${className}`} />
    </>
  );
}

/** 구분 선택 값 (픽업/샌딩/시내 전세/기타) */
function tripValue(t: string | null | undefined): string {
  const k = tripKind(t ?? null);
  return k === "pickup" ? "공항 픽업" : k === "sending" ? "공항 샌딩" : /전세/.test(t ?? "") ? "시내 전세" : "";
}

function CountCells({ c }: { c: DayCount }) {
  return (
    <>
      <td className="text-right">{num(c.pickup)}</td>
      <td className="text-right">{num(c.sending)}</td>
      <td className="text-right">{num(c.other)}</td>
      <td className="text-right font-semibold">{num(c.pickup + c.sending + c.other)}</td>
      <td className="text-right text-violet-700">{num(c.own)}</td>
    </>
  );
}

const COUNT_HEAD = (
  <>
    <th className="text-right">픽업</th>
    <th className="text-right">샌딩</th>
    <th className="text-right">기타</th>
    <th className="text-right">합계</th>
    <th className="text-right">외부오더</th>
  </>
);

export default async function VehicleSettlementPage({ searchParams }: { searchParams: Promise<{ month?: string; v?: string; msg?: string }> }) {
  const sp = await searchParams;
  const month = isMonth(sp.month) ? sp.month : todayKst().slice(0, 7);
  const { supabase } = await requireOwner();
  const report = await loadVehicleMonth(supabase, month);
  const selected = sp.v ? report.vehicles.find((v) => v.key === sp.v) : undefined;

  return (
    <div className="space-y-6">
      <h1 className="page-title">차량별 월정산</h1>
      <form className="card flex flex-wrap items-end gap-3">
        <div>
          <label className="label" htmlFor="month">정산 월</label>
          <input id="month" type="month" name="month" defaultValue={month} className="input" />
        </div>
        <div>
          <label className="label" htmlFor="v">차량</label>
          <select id="v" name="v" defaultValue={sp.v ?? ""} className="input">
            <option value="">전체 차량</option>
            {report.vehicles.map((v) => (
              <option key={v.key} value={v.key}>{vehicleTitle(v.plate, v.driverName)}</option>
            ))}
          </select>
        </div>
        <button className="btn-secondary">조회</button>
        <div className="ml-auto flex flex-wrap gap-2">
          {selected ? (
            <a className="btn" href={`/admin/vehicle-settlement/xlsx?month=${month}&v=${encodeURIComponent(selected.key)}`}>{vehicleTitle(selected.plate, selected.driverName)} 정산서 엑셀</a>
          ) : (
            <a className="btn" href={`/admin/vehicle-settlement/xlsx?month=${month}`}>전체 차량 정산서 엑셀</a>
          )}
          <a className="btn-secondary" href={`/admin/vehicle-settlement/export?month=${month}${selected ? `&v=${encodeURIComponent(selected.key)}` : ""}`}>CSV</a>
        </div>
      </form>

      {sp.msg && <p className="rounded-lg bg-blue-50 p-3 text-sm text-blue-900">{sp.msg}</p>}

      {report.draftOnlyDates.length > 0 && (
        <div className="card border-amber-300 bg-amber-50 text-sm text-amber-900">
          배차가 확정되지 않아 정산에서 빠진 날:{" "}
          {report.draftOnlyDates.map((d) => (
            <Link key={d} href={`/admin/dispatch?date=${d}`} className="mr-2 underline">{dayLabel(d)}</Link>
          ))}
        </div>
      )}

      {selected ? <VehicleDetail report={report} v={selected} /> : <Overview report={report} />}
    </div>
  );
}

function Overview({ report }: { report: VehicleMonthReport }) {
  const [, mon] = report.month.split("-").map(Number);
  const sum = (f: (v: VehicleMonthReport["vehicles"][number]) => number) => report.vehicles.reduce((s, v) => s + f(v), 0);
  const ext = report.external.reduce(
    (t, d) => ({ pickup: t.pickup + d.pickup, sending: t.sending + d.sending, other: t.other + d.other, fare: t.fare + d.fare }),
    { pickup: 0, sending: 0, other: 0, fare: 0 },
  );
  return (
    <>
      <p className="text-sm text-gray-500">
        <b>확정된 배차</b>만 셉니다. 차량을 누르면 날짜별 건수, 건별 금액, 비용 입력 화면이 나옵니다.
        배차 금액은 전부 지급하고(비용·원천세 3.3%만 뺌), 외부오더(기사 자체 콜)의 −금액(건당 {won(report.ownCallFee)}, 시트에 금액이 적혀 있으면 그 금액)은
        지급액에서 빼지 않습니다 (차량을 누르면 상세에서 확인). KKday 차액은 KKday 정산액에서 부가세를 빼고 그 건들 기사 지급액을 뺀 금액입니다.
      </p>
      <div className="card overflow-x-auto !p-0">
        <table className="table">
          <thead>
            <tr>
              <th>차량 · 기사</th><th className="text-right">운행일</th>{COUNT_HEAD}
              <th className="text-right">금액 합계</th><th className="text-right">비용</th><th className="text-right">차액</th>
              <th className="text-right">세액</th><th className="text-right">지급액</th><th className="text-right" title="KKday 정산내역서에서 이 기사가 운행한 건들의 정산 금액 합계 (부가세 포함)">KKday 정산액</th><th className="text-right" title="KKday 정산액 ÷ 1.1">부가세 제외</th><th className="text-right" title="부가세 제외 금액 − 그 건들에 기사에게 준 금액 (정산내역서에 있는 건만)">KKday 차액</th><th>삭제</th>
            </tr>
          </thead>
          <tbody>
            {report.vehicles.map((v) => (
              <tr key={v.key}>
                <td>
                  <Link href={`/admin/vehicle-settlement?month=${report.month}&v=${encodeURIComponent(v.key)}`} className="font-medium text-blue-700 hover:underline">
                    {vehicleTitle(v.plate, v.driverName)}
                  </Link>
                  {v.status === "confirmed" && <span className="badge ml-2 bg-green-100 text-green-800">확정</span>}
                </td>
                <td className="text-right">{v.total.workDays}일</td>
                <CountCells c={v.total} />
                <td className="text-right">{won(v.payout.amount)}</td>
                <td className="text-right">{v.expenses ? won(v.payout.expenses) : <span className="text-amber-600">미입력</span>}</td>
                <td className="text-right">{won(v.payout.diff)}</td>
                <td className="text-right">{won(v.payout.tax)}</td>
                <td className="text-right font-semibold">{won(v.payout.pay)}</td>
                {(() => {
                  const k = kkdayTotals(v.rows);
                  return k.count ? (
                    <>
                      <td className="whitespace-nowrap text-right" title={`정산내역서에 있는 ${k.count}건`}>{won(k.amount)}</td>
                      <td className="whitespace-nowrap text-right text-gray-600">{won(k.net)}</td>
                      <td className="whitespace-nowrap text-right font-semibold" title={`부가세 제외 ${won(k.net)} − 기사 지급 ${won(k.paid)} (${k.count}건)`}>{diffCell(k.diff)}</td>
                    </>
                  ) : (
                    <><td className="text-right">{diffCell(null)}</td><td className="text-right">{diffCell(null)}</td><td className="text-right">{diffCell(null)}</td></>
                  );
                })()}
                <td>
                  {v.status === "confirmed" ? (
                    <span className="text-xs text-gray-400" title="확정 해제 후 삭제할 수 있습니다">확정됨</span>
                  ) : (
                    <form action={deleteVehicleMonthQuick} className="flex items-center gap-1">
                      <input type="hidden" name="month" value={report.month} />
                      <input type="hidden" name="vehicleId" value={v.vehicleId} />
                      <input type="hidden" name="operator" value={v.operator} />
                      <label className="flex items-center gap-1 text-xs text-gray-500"><input type="checkbox" name="confirm" /> 확인</label>
                      <SubmitButton className="btn-danger !px-2 !py-1 text-xs" pendingText="...">삭제</SubmitButton>
                    </form>
                  )}
                </td>
              </tr>
            ))}
            {!report.vehicles.length && <tr><td colSpan={16} className="text-gray-500">{mon}월에 확정된 배차가 없습니다.</td></tr>}
          </tbody>
          {report.vehicles.length > 0 && (
            <tfoot>
              <tr className="font-semibold">
                <td className="px-3 py-2">합계 ({report.vehicles.length}대)</td>
                <td />
                <td className="px-3 py-2 text-right">{num(sum((v) => v.total.pickup))}</td>
                <td className="px-3 py-2 text-right">{num(sum((v) => v.total.sending))}</td>
                <td className="px-3 py-2 text-right">{num(sum((v) => v.total.other))}</td>
                <td className="px-3 py-2 text-right">{num(sum((v) => v.total.calls))}</td>
                <td className="px-3 py-2 text-right">{num(sum((v) => v.total.own))}</td>
                <td className="px-3 py-2 text-right">{won(sum((v) => v.payout.amount))}</td>
                <td className="px-3 py-2 text-right">{won(sum((v) => v.payout.expenses))}</td>
                <td className="px-3 py-2 text-right">{won(sum((v) => v.payout.diff))}</td>
                <td className="px-3 py-2 text-right">{won(sum((v) => v.payout.tax))}</td>
                <td className="px-3 py-2 text-right">{won(sum((v) => v.payout.pay))}</td>
                <td className="whitespace-nowrap px-3 py-2 text-right">{won(sum((v) => kkdayTotals(v.rows).amount))}</td>
                <td className="whitespace-nowrap px-3 py-2 text-right">{won(sum((v) => kkdayTotals(v.rows).net))}</td>
                <td className="whitespace-nowrap px-3 py-2 text-right">{diffCell(sum((v) => kkdayTotals(v.rows).diff))}</td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      <form action={deleteWholeMonth} className="card flex flex-wrap items-center gap-3 border-red-200">
        <input type="hidden" name="month" value={report.month} />
        <div className="text-sm">
          <b className="text-red-700">{mon}월 전체 삭제</b>
          <span className="ml-2 text-gray-600">
            {mon}월의 예약·배차(외부 콜 포함), 직접 추가 항목, 비용·확정 정산을 모두 지웁니다. 차량·기사·설정은 남습니다. 되돌릴 수 없습니다.
          </span>
        </div>
        <input name="confirmWord" placeholder="'삭제' 입력" className="input !w-28" autoComplete="off" />
        <SubmitButton className="btn-danger">{mon}월 전체 삭제</SubmitButton>
      </form>

      {report.external.length > 0 && (
        <details className="card">
          <summary className="cursor-pointer">
            <span className="font-semibold">외부(타업체)로 넘긴 콜</span>
            <span className="ml-3 text-sm text-gray-600">
              픽업 {ext.pickup}건 · 샌딩 {ext.sending}건{ext.other > 0 && ` · 기타 ${ext.other}건`} · {won(ext.fare)}
            </span>
          </summary>
          <div className="mt-3 overflow-x-auto">
            <table className="table">
              <thead><tr><th>날짜</th><th className="text-right">픽업</th><th className="text-right">샌딩</th><th className="text-right">기타</th><th className="text-right">금액</th></tr></thead>
              <tbody>
                {report.external.map((d) => (
                  <tr key={d.date}>
                    <td>{dayLabel(d.date)}</td>
                    <td className="text-right">{num(d.pickup)}</td>
                    <td className="text-right">{num(d.sending)}</td>
                    <td className="text-right">{num(d.other)}</td>
                    <td className="text-right">{won(d.fare)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </>
  );
}

function VehicleDetail({ report, v }: { report: VehicleMonthReport; v: VehicleMonthReport["vehicles"][number] }) {
  const [, mon] = report.month.split("-").map(Number);
  const p = v.payout;
  const ex = v.expenses;
  const locked = v.status === "confirmed";
  const ids = (
    <>
      <input type="hidden" name="month" value={report.month} />
      <input type="hidden" name="vehicleId" value={v.vehicleId} />
      <input type="hidden" name="operator" value={v.operator} />
    </>
  );
  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-xl font-bold">{[report.companyName, `${mon}월`].filter(Boolean).join(" ")} — {vehicleTitle(v.plate, v.driverName)}</h2>
        <span className={`badge ${locked ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-700"}`}>
          {locked ? `확정${v.confirmedAt ? ` (${v.confirmedAt.slice(5, 10).replace("-", "/")})` : ""}` : "작성 중"}
        </span>
        <Link href={`/admin/vehicle-settlement?month=${report.month}`} className="text-sm text-blue-700 hover:underline">← 전체 차량</Link>
        <form action={setSettlementStatus} className="ml-auto">
          {ids}
          <input type="hidden" name="status" value={locked ? "draft" : "confirmed"} />
          <SubmitButton className={locked ? "btn-secondary" : "btn"}>{locked ? "확정 해제" : "정산 확정"}</SubmitButton>
        </form>
      </div>
      {locked ? (
        <p className="rounded-lg bg-green-50 p-3 text-sm text-green-800">
          확정된 정산입니다. 금액·비용·항목이 잠겨 있고, {v.operator ? "관리자만 볼 수 있습니다" : "기사 화면에 이 내역이 보입니다"}. 고치려면 &quot;확정 해제&quot;를 누르세요.
        </p>
      ) : (
        <p className="text-sm text-gray-500">금액·비용을 확인한 뒤 &quot;정산 확정&quot;을 누르면 잠기고 기사 화면에 정산서가 표시됩니다.</p>
      )}

      {/* 정산 계산 */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card">
          <h3 className="mb-2 font-semibold">정산</h3>
          <table className="w-full text-sm">
            <tbody>
              <Line label={`금액 합계 (${v.total.calls}건)`} value={p.amount} />
              <Line label="비용 합계" value={-p.expenses} />
              <Line label="차액" value={p.diff} strong />
              <Line label={`세액 (소득세 ${won(p.incomeTax)} + 지방소득세 ${won(p.localTax)})`} value={-p.tax} />
              <Line label="지급액" value={p.pay} strong big />
            </tbody>
          </table>
          {(() => {
            const k = kkdayTotals(v.rows);
            return k.count > 0 ? (
              <div className="mt-3 rounded-lg bg-gray-50 px-3 py-2 text-sm">
                <div className="mb-1 font-semibold">KKday 기준 ({k.count}건, 정산내역서에 있는 건만)</div>
                <table className="w-full">
                  <tbody>
                    <Line label="KKday 정산액 (부가세 포함)" value={k.amount} />
                    <Line label="부가세 제외 (÷1.1)" value={k.net} />
                    <Line label="그 건들 기사 지급" value={-k.paid} />
                    <Line label="KKday 차액 (남은 금액)" value={k.diff} strong />
                  </tbody>
                </table>
              </div>
            ) : null;
          })()}
          {v.total.own > 0 && (
            <p className="mt-3 rounded-lg bg-violet-50 px-3 py-2 text-sm text-violet-800">
              외부오더 {v.total.own}건 <b>{won(v.total.ownAmount)}</b>은 지급액에서 빼지 않았습니다. 기사님께 별도로 받을 금액입니다.
            </p>
          )}
        </div>
        <form action={saveExpenses} className="card space-y-3">
          <h3 className="font-semibold">{mon}월 비용 {!ex && <span className="text-sm font-normal text-amber-600">(미입력)</span>}</h3>
          {ids}
          <fieldset disabled={locked} className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {(Object.keys(EXPENSE_LABELS) as (keyof typeof EXPENSE_LABELS)[]).map((k) => (
              <div key={k}>
                <label className="label" htmlFor={k}>{EXPENSE_LABELS[k]}</label>
                <input id={k} name={k} type="number" defaultValue={ex?.[k] || ""} placeholder="0" className="input text-right" />
              </div>
            ))}
            <div className="col-span-2 sm:col-span-3">
              <label className="label" htmlFor="memo">메모</label>
              <input id="memo" name="memo" defaultValue={ex?.memo ?? ""} placeholder="예: 8/9 과태료 3만2천" className="input" />
            </div>
          </fieldset>
          {!locked && <SubmitButton>비용 저장</SubmitButton>}
        </form>
      </div>

      {/* 같은 차량을 운행한 다른 기사의 정산 (따로 정산) */}
      {(() => {
        const same = report.vehicles.filter((x) => x.vehicleId === v.vehicleId && x.key !== v.key);
        return same.length > 0 ? (
          <div className="card border-amber-200 bg-amber-50/50 text-sm">
            <b>같은 차량({v.plate})의 다른 기사 정산</b> — 시트 기사 칸 기준으로 기사별 따로 정산합니다:{" "}
            {same.map((x) => (
              <Link key={x.key} href={`/admin/vehicle-settlement?month=${report.month}&v=${encodeURIComponent(x.key)}`} className="mr-3 font-medium text-blue-700 underline">
                {vehicleTitle(x.plate, x.driverName)} ({x.total.calls + x.total.own}건 · 지급 {won(x.payout.pay)})
              </Link>
            ))}
          </div>
        ) : null;
      })()}

      {/* 날짜별 건수 */}
      <details className="card" open>
        <summary className="cursor-pointer font-semibold">
          날짜별 건수 <span className="ml-2 text-sm font-normal text-gray-600">
            픽업 {v.total.pickup}건 · 샌딩 {v.total.sending}건{v.total.other ? ` · 기타 ${v.total.other}건` : ""}{v.total.own ? ` · 외부오더 ${v.total.own}건` : ""} · 운행 {v.total.workDays}일
          </span>
        </summary>
        <div className="mt-3 overflow-x-auto">
          <table className="table">
            <thead><tr><th>날짜</th>{COUNT_HEAD}<th className="text-right">금액</th></tr></thead>
            <tbody>
              {v.days.map((d) => (
                <tr key={d.date}>
                  <td><Link href={`/admin/dispatch?date=${d.date}`} className="hover:underline">{dayLabel(d.date)}</Link></td>
                  <CountCells c={d} />
                  <td className="text-right">{won(d.amount)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="font-semibold">
                <td className="px-3 py-2">{mon}월 합계</td>
                <td className="px-3 py-2 text-right">{num(v.total.pickup)}</td>
                <td className="px-3 py-2 text-right">{num(v.total.sending)}</td>
                <td className="px-3 py-2 text-right">{num(v.total.other)}</td>
                <td className="px-3 py-2 text-right">{num(v.total.calls)}</td>
                <td className="px-3 py-2 text-right">{num(v.total.own)}</td>
                <td className="px-3 py-2 text-right">{won(v.total.amount)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </details>

      {/* 건별 내역 (엑셀 정산표와 같은 순서) */}
      <form action={saveAmounts} className="card space-y-3">
        {ids}
        <div className="flex flex-wrap items-center gap-3">
          <h3 className="font-semibold">건별 내역 ({v.rows.length}건)</h3>
          <p className="text-xs text-gray-500">
            항공편·구분·차량스펙·인원·비고·금액을 고친 뒤 저장하세요. 기본 금액은 설정의 콜 금액 규칙(기본·김포·피켓·어린이 좌석)으로 채워지며,
            비고에 &quot;피켓 1&quot;, &quot;어린이 좌석 1&quot;을 넣으면 추가금이 붙습니다. 금액 칸을 비우면 기본값으로 돌아갑니다 (외부오더는 −시트 금액, 없으면 −{won(report.ownCallFee)}).
          </p>
          {!locked && <SubmitButton className="ml-auto">저장</SubmitButton>}
        </div>
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>{!locked && <th><SelectAll name="sel" /></th>}<th>예약번호</th><th>항공편</th><th>인아웃</th><th>날짜</th><th>시간</th><th>운행 기사</th><th>차량스펙</th><th className="text-right">인원</th><th>비고</th><th className="text-right">금액</th><th className="text-right" title="KKday 정산내역서 금액(부가세 포함) ÷ 1.1">KKday 부가세 제외</th><th className="text-right">차액</th></tr>
            </thead>
            <tbody>
              {v.rows.map((r) => {
                const own = r.source === OWN_CALL;
                return (
                  <tr key={r.id} className={own ? "bg-violet-50" : r.manualSource ? "bg-sky-50" : ""}>
                    {!locked && <td><input type="checkbox" name="sel" value={r.id} aria-label="선택" /></td>}
                    <td className="whitespace-nowrap text-xs">
                      {own ? "외부오더" : r.bookingNo}
                      {r.manualSource && <span className="badge ml-1 bg-sky-100 text-sky-800">직접 추가</span>}
                      {r.manualSource && !locked && (
                        <button formAction={deleteManualItem} name="itemId" value={r.id} className="ml-1 text-red-600 hover:underline">삭제</button>
                      )}
                    </td>
                    <td className="text-xs">{locked ? r.flightNo : <Editable id={r.id} f="flight" value={r.flightNo} className="!w-24" />}</td>
                    <td className="whitespace-nowrap">
                      {locked || own ? inOutLabel(r) : (
                        <>
                          <input type="hidden" name={`o_trip_${r.id}`} value={tripValue(r.tripType)} />
                          <select name={`f_trip_${r.id}`} defaultValue={tripValue(r.tripType)} className="input !w-24 !py-1 text-sm">
                            <option value="공항 픽업">픽업</option>
                            <option value="공항 샌딩">샌딩</option>
                            <option value="시내 전세">시내 전세</option>
                            <option value="">기타</option>
                          </select>
                        </>
                      )}
                    </td>
                    <td className="whitespace-nowrap">{dayLabel(r.serviceDate)}</td>
                    <td>{r.pickupAt ? fmtTime(r.pickupAt) : ""}</td>
                    <td className={`whitespace-nowrap text-xs ${r.operator && v.driverName && !v.driverName.includes(r.operator) ? "font-semibold text-amber-700" : "text-gray-600"}`}
                      title={r.operator && v.driverName && !v.driverName.includes(r.operator) ? "차량 담당 기사와 다른 기사가 운행" : undefined}>
                      {r.operator ?? ""}
                    </td>
                    <td className="whitespace-nowrap text-xs">{locked ? r.vehicleClass : <Editable id={r.id} f="cls" value={r.vehicleClass} className="!w-32" />}</td>
                    <td className="text-right">{own ? "" : locked ? r.pax : <Editable id={r.id} f="pax" value={r.pax} type="number" className="!w-16 text-right" />}</td>
                    <td className="text-xs text-gray-600" title={r.memo ?? ""}>
                      {locked ? <span className="block max-w-64 truncate">{r.memo}</span> : <Editable id={r.id} f="memo" value={r.memo} className="!w-64" placeholder="예: 피켓 1, 어린이 좌석 1" />}
                    </td>
                    <td className="text-right">
                      <input type="hidden" name={`orig_${r.id}`} value={r.amount} />
                      <input
                        name={`amount_${r.id}`}
                        type="number"
                        step="1000"
                        defaultValue={r.amount}
                        disabled={locked}
                        className={`input !w-28 !py-1 text-right ${r.edited ? "border-blue-400 bg-blue-50" : ""} ${r.amount < 0 ? "text-red-600" : ""}`}
                      />
                    </td>
                    {(() => {
                      const k = kkdayDiffOf(r);
                      return (
                        <>
                          <td className="whitespace-nowrap text-right text-gray-600" title={r.kkdayAmount != null ? `KKday 정산 ${won(r.kkdayAmount)} (부가세 포함)` : undefined}>{k ? won(k.net) : <span className="text-gray-400">-</span>}</td>
                          <td className="whitespace-nowrap text-right font-semibold">{diffCell(k?.diff)}</td>
                        </>
                      );
                    })()}
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="font-semibold">
                <td colSpan={locked ? 9 : 10} className="px-3 py-2">금액 합계 (지급 대상, 외부오더 제외)</td>
                <td className="px-3 py-2 text-right">{won(v.total.amount)}</td>
                {(() => {
                  const k = kkdayTotals(v.rows);
                  return (
                    <>
                      <td className="whitespace-nowrap px-3 py-2 text-right" title={`KKday 정산 ${won(k.amount)} (부가세 포함, ${k.count}건)`}>{won(k.net)}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-right">{diffCell(k.count ? k.diff : null)}</td>
                    </>
                  );
                })()}
              </tr>
              {v.total.own > 0 && (
                <tr className="font-semibold text-violet-700">
                  <td colSpan={locked ? 9 : 10} className="px-3 py-2">외부오더 {v.total.own}건 · 별도 수금 (지급에서 빼지 않음)</td>
                  <td className="px-3 py-2 text-right">{won(v.total.ownAmount)}</td>
                  <td colSpan={2} />
                </tr>
              )}
            </tfoot>
          </table>
        </div>
        {!locked && (
          <div className="flex flex-wrap items-center gap-3 border-t border-gray-100 pt-3">
            <span className="text-sm text-gray-600">체크한 건:</span>
            <label className="flex items-center gap-1 text-sm text-gray-600">
              <input type="checkbox" name="confirmDelete" /> 삭제 확인
            </label>
            <button formAction={deleteSelectedRows} className="btn-danger">선택한 건 삭제</button>
            <span className="text-xs text-gray-500">배차 건은 예약·배차에서도 삭제됩니다. 직접 추가한 항목은 그 항목만 지워집니다.</span>
            <SubmitButton className="ml-auto">저장</SubmitButton>
          </div>
        )}
      </form>

      {/* 배차에 없는 콜 직접 추가 (TALIXO 등) */}
      {!locked && (
        <form action={addManualItem} className="card space-y-3">
          {ids}
          <h3 className="font-semibold">
            항목 직접 추가 <span className="text-sm font-normal text-gray-500">TALIXO 등 다른 플랫폼 콜, 기타 가감(음수 가능)</span>
          </h3>
          <div className="grid gap-2 sm:grid-cols-4 lg:grid-cols-6">
            <input name="work_date" type="date" required defaultValue={`${report.month}-01`} min={`${report.month}-01`} max={`${report.month}-31`} className="input" />
            <input name="work_time" placeholder="시간 (08:30)" className="input" />
            <select name="source" defaultValue="TALIXO" className="input">
              <option>TALIXO</option>
              <option>KKday</option>
              <option>기타</option>
            </select>
            <select name="trip_type" defaultValue="공항 픽업" className="input">
              <option value="공항 픽업">픽업</option>
              <option value="공항 샌딩">샌딩</option>
              <option value="">기타 (가감)</option>
            </select>
            <input name="ref_no" placeholder="주문번호" className="input" />
            <input name="flight_no" placeholder="항공편" className="input" />
            <input name="vehicle_class" placeholder="차량스펙 (Business VAN 등)" className="input" />
            <input name="pax" type="number" min={1} placeholder="인원" className="input" />
            <input name="memo" placeholder="비고 (고객명 등)" className="input sm:col-span-2" />
            <input name="amount" required inputMode="numeric" placeholder="금액 (예: 40000, -15000)" className="input sm:col-span-2" />
          </div>
          <SubmitButton>추가</SubmitButton>
        </form>
      )}

      {/* 삭제 · 초기화 */}
      {locked ? (
        <p className="text-sm text-gray-500">확정된 정산은 삭제·초기화할 수 없습니다. 먼저 &quot;확정 해제&quot;를 누르세요.</p>
      ) : (
        <div className="card space-y-4 border-red-200">
          <h3 className="font-semibold text-red-700">삭제 · 초기화</h3>
          <form action={resetVehicleSettlement} className="flex flex-wrap items-center gap-3">
            {ids}
            <div className="text-sm">
              <b>정산 입력 초기화</b>
              <span className="ml-2 text-gray-500">{mon}월 비용, 직접 추가 항목, 건별 금액 수정을 지웁니다. 운행 내역은 그대로입니다.</span>
            </div>
            <label className="flex items-center gap-1 text-sm text-gray-600"><input type="checkbox" name="confirmReset" /> 확인</label>
            <SubmitButton className="btn-danger">초기화</SubmitButton>
          </form>
          <form action={deleteVehicleMonth} className="flex flex-wrap items-center gap-3 border-t border-red-100 pt-4">
            {ids}
            <div className="text-sm">
              <b>{v.plate} {mon}월 운행 전체 삭제</b>
              <span className="ml-2 text-gray-500">이 차량의 {mon}월 예약·배차 {v.rows.filter((r) => !r.manualSource).length}건과 정산 입력을 모두 지웁니다. 되돌릴 수 없습니다.</span>
            </div>
            <input name="confirmWord" placeholder="'삭제' 입력" className="input !w-28" autoComplete="off" />
            <SubmitButton className="btn-danger">전체 삭제</SubmitButton>
          </form>
        </div>
      )}
    </>
  );
}

function Line({ label, value, strong, big }: { label: string; value: number; strong?: boolean; big?: boolean }) {
  return (
    <tr className={`border-b border-gray-100 last:border-0 ${strong ? "font-semibold" : ""} ${big ? "text-lg" : ""}`}>
      <td className="py-1.5 text-gray-700">{label}</td>
      <td className={`py-1.5 text-right ${value < 0 ? "text-red-600" : ""}`}>{won(value)}</td>
    </tr>
  );
}
