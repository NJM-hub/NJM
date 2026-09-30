import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { fmtTime, isMonth, todayKst, won } from "@/lib/format";
import { SubmitButton } from "@/components/SubmitButton";
import { loadVehicleMonth, type VehicleMonthReport } from "@/lib/settlement/vehicleMonthlyLoad";
import { EXPENSE_LABELS, inOutLabel, OWN_CALL, type DayCount } from "@/lib/settlement/vehicleMonthly";
import { addManualItem, deleteManualItem, saveAmounts, saveExpenses, setSettlementStatus } from "./actions";

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

export default async function VehicleSettlementPage({ searchParams }: { searchParams: Promise<{ month?: string; v?: string }> }) {
  const sp = await searchParams;
  const month = isMonth(sp.month) ? sp.month : todayKst().slice(0, 7);
  const { supabase } = await requireAdmin();
  const report = await loadVehicleMonth(supabase, month);
  const selected = sp.v ? report.vehicles.find((v) => v.vehicleId === sp.v) : undefined;

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
              <option key={v.vehicleId} value={v.vehicleId}>{vehicleTitle(v.plate, v.driverName)}</option>
            ))}
          </select>
        </div>
        <button className="btn-secondary">조회</button>
        <div className="ml-auto flex flex-wrap gap-2">
          {selected ? (
            <a className="btn" href={`/admin/vehicle-settlement/xlsx?month=${month}&v=${selected.vehicleId}`}>{selected.plate} 정산서 엑셀</a>
          ) : (
            <a className="btn" href={`/admin/vehicle-settlement/xlsx?month=${month}`}>전체 차량 정산서 엑셀</a>
          )}
          <a className="btn-secondary" href={`/admin/vehicle-settlement/export?month=${month}${selected ? `&v=${selected.vehicleId}` : ""}`}>CSV</a>
        </div>
      </form>

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
        외부오더(기사 자체 콜)는 건당 {won(report.ownCallFee)}씩 빼고(설정에서 변경), 차액에서 원천세 3.3%를 뗀 금액이 지급액입니다.
      </p>
      <div className="card overflow-x-auto !p-0">
        <table className="table">
          <thead>
            <tr>
              <th>차량 · 기사</th><th className="text-right">운행일</th>{COUNT_HEAD}
              <th className="text-right">금액 합계</th><th className="text-right">비용</th><th className="text-right">차액</th>
              <th className="text-right">세액</th><th className="text-right">지급액</th>
            </tr>
          </thead>
          <tbody>
            {report.vehicles.map((v) => (
              <tr key={v.vehicleId}>
                <td>
                  <Link href={`/admin/vehicle-settlement?month=${report.month}&v=${v.vehicleId}`} className="font-medium text-blue-700 hover:underline">
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
              </tr>
            ))}
            {!report.vehicles.length && <tr><td colSpan={12} className="text-gray-500">{mon}월에 확정된 배차가 없습니다.</td></tr>}
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
              </tr>
            </tfoot>
          )}
        </table>
      </div>

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
          확정된 정산입니다. 금액·비용·항목이 잠겨 있고, 기사 화면에 이 내역이 보입니다. 고치려면 &quot;확정 해제&quot;를 누르세요.
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
              <Line label={`금액 합계 (${v.total.calls}건${v.total.own ? `, 외부오더 ${v.total.own}건 차감` : ""})`} value={p.amount} />
              <Line label="비용 합계" value={-p.expenses} />
              <Line label="차액" value={p.diff} strong />
              <Line label={`세액 (소득세 ${won(p.incomeTax)} + 지방소득세 ${won(p.localTax)})`} value={-p.tax} />
              <Line label="지급액" value={p.pay} strong big />
            </tbody>
          </table>
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
            기본 금액은 설정의 콜 금액 규칙(기본·김포·피켓)으로 채워집니다. 고친 뒤 저장하세요. 칸을 비우면 기본값으로 돌아갑니다 (외부오더는 −{won(report.ownCallFee)}).
          </p>
          {!locked && <SubmitButton className="ml-auto">금액 저장</SubmitButton>}
        </div>
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr><th>예약번호</th><th>항공편</th><th>인아웃</th><th>날짜</th><th>시간</th><th>차량스펙</th><th className="text-right">인원</th><th>비고</th><th className="text-right">금액</th></tr>
            </thead>
            <tbody>
              {v.rows.map((r) => {
                const own = r.source === OWN_CALL;
                return (
                  <tr key={r.id} className={own ? "bg-violet-50" : r.manualSource ? "bg-sky-50" : ""}>
                    <td className="whitespace-nowrap text-xs">
                      {own ? "외부오더" : r.bookingNo}
                      {r.manualSource && <span className="badge ml-1 bg-sky-100 text-sky-800">직접 추가</span>}
                      {r.manualSource && !locked && (
                        <button formAction={deleteManualItem} name="itemId" value={r.id} className="ml-1 text-red-600 hover:underline">삭제</button>
                      )}
                    </td>
                    <td className="text-xs">{r.flightNo}</td>
                    <td className="whitespace-nowrap">{inOutLabel(r)}</td>
                    <td className="whitespace-nowrap">{dayLabel(r.serviceDate)}</td>
                    <td>{r.pickupAt ? fmtTime(r.pickupAt) : ""}</td>
                    <td className="whitespace-nowrap text-xs">{r.vehicleClass}</td>
                    <td className="text-right">{own ? "" : r.pax}</td>
                    <td className="max-w-64 truncate text-xs text-gray-500" title={r.memo ?? ""}>{r.memo}</td>
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
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="font-semibold">
                <td colSpan={8} className="px-3 py-2">금액 합계</td>
                <td className="px-3 py-2 text-right">{won(v.total.amount)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        {!locked && <div className="flex justify-end"><SubmitButton>금액 저장</SubmitButton></div>}
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
