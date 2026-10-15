import Link from "next/link";
import { notFound } from "next/navigation";
import { SubmitButton } from "@/components/SubmitButton";
import { requireViewer } from "@/lib/auth";
import { decrypt } from "@/lib/crypto";
import { canonicalDriver, parseDriverAliases } from "@/lib/driverAlias";
import { isMonth, won } from "@/lib/format";
import { formatRrn } from "@/lib/pii";
import { loadSettings } from "@/lib/settings";
import { loadVehicleMonth } from "@/lib/settlement/vehicleMonthlyLoad";
import { saveDriverMonthNote } from "../rosterActions";

const monthLabel = (m: string) => `${m.slice(2, 4)}년 ${Number(m.slice(5))}월`;
const norm = (s: string | null | undefined) => (s ?? "").replace(/\s+/g, "");

type Roster = { id: string; name: string; vehicle_id: string | null; rrn_enc: string | null; bank_name: string | null; bank_account_enc: string | null; account_holder: string | null };

/** 월별 기사 지급표: 차량별 월정산의 기사(정산 단위)마다 명단의 주민번호·계좌와 실제 지급액 */
export default async function DriverPayPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const { month } = await searchParams;
  if (!isMonth(month)) notFound();
  const { supabase } = await requireViewer();
  const [report, settings, { data: rosterRows }, { data: notes }] = await Promise.all([
    loadVehicleMonth(supabase, month),
    loadSettings(supabase),
    supabase.from("driver_roster").select("id,name,vehicle_id,rrn_enc,bank_name,bank_account_enc,account_holder"),
    supabase.from("driver_month_notes").select("unit_key,note").eq("month", month),
  ]);
  const aliases = parseDriverAliases(settings.driver_aliases);
  const key = (n: string | null | undefined) => norm(canonicalDriver(n ?? "", aliases) ?? n);
  const roster = (rosterRows ?? []) as Roster[];
  // 같은 이름이 여럿이면 같은 차량을 먼저
  const find = (name: string, vehicleId: string) => {
    const list = roster.filter((r) => key(r.name) === key(name));
    return list.find((r) => r.vehicle_id === vehicleId) ?? list[0] ?? null;
  };
  const noteOf = new Map((notes ?? []).map((n) => [n.unit_key as string, (n.note as string | null) ?? ""]));

  const rows = report.vehicles.map((v) => {
    const name = v.operator || v.driverName || "";
    const r = name ? find(name, v.vehicleId) : null;
    const rrn = r ? decrypt(r.rrn_enc) : null;
    return {
      key: v.key, plate: v.plate, name, status: v.status, pay: v.payout.pay,
      rrn: rrn ? formatRrn(rrn) : null,
      account: r ? [r.bank_name, decrypt(r.bank_account_enc), r.account_holder && r.account_holder !== r.name ? `(${r.account_holder})` : null].filter(Boolean).join(" ") || null : null,
      inRoster: !!r,
    };
  });
  const total = rows.reduce((s, r) => s + r.pay, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-baseline gap-3">
        <Link href="/admin/drivers" className="text-sm text-blue-700 underline">← 기사 관리</Link>
        <h1 className="page-title">{monthLabel(month)} 기사 지급표</h1>
      </div>
      <form className="card flex flex-wrap items-end gap-3">
        <div>
          <label className="label" htmlFor="month">지급 월</label>
          <input id="month" type="month" name="month" defaultValue={month} required className="input" />
        </div>
        <button className="btn-secondary">조회</button>
      </form>
      <p className="text-sm text-gray-500">
        지급액은 차량별 월정산의 실제 지급액(원천세 뺀 금액)입니다. 주민번호·계좌는 기사 관리의 소속 기사 명단에서 이름으로 찾아옵니다.
      </p>
      <div className="card overflow-x-auto !p-0">
        <table className="table">
          <thead>
            <tr><th>차량</th><th>기사</th><th>주민번호</th><th>계좌번호</th><th className="text-right">지급액</th><th>비고</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const f = `note-${r.key}`;
              return (
                <tr key={r.key}>
                  <td className="whitespace-nowrap">{r.plate}</td>
                  <td className="whitespace-nowrap">
                    {r.name || "-"}
                    {r.status !== "confirmed" && <span className="badge ml-1 bg-gray-100 text-gray-600">미확정</span>}
                  </td>
                  <td className="whitespace-nowrap">{r.rrn ?? <span className="text-xs text-red-600">{r.inRoster ? "없음" : "명단에 없음"}</span>}</td>
                  <td className="whitespace-nowrap">{r.account ?? <span className="text-xs text-red-600">{r.inRoster ? "없음" : "명단에 없음"}</span>}</td>
                  <td className={`whitespace-nowrap text-right font-semibold ${r.pay < 0 ? "text-red-600" : ""}`}>{won(r.pay)}</td>
                  <td className="whitespace-nowrap">
                    <form id={f} action={saveDriverMonthNote} className="flex gap-1">
                      <input type="hidden" name="month" value={month} />
                      <input type="hidden" name="unitKey" value={r.key} />
                      <input name="note" defaultValue={noteOf.get(r.key) ?? ""} className="input !w-48 !py-1" />
                      <SubmitButton className="btn-secondary !px-2 !py-1 text-xs" pendingText="...">저장</SubmitButton>
                    </form>
                  </td>
                </tr>
              );
            })}
            {!rows.length && <tr><td colSpan={6} className="text-gray-500">{monthLabel(month)} 정산 내역이 없습니다.</td></tr>}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr className="font-semibold">
                <td className="px-3 py-2">합계 ({rows.length}명)</td><td /><td /><td />
                <td className="px-3 py-2 text-right">{won(total)}</td><td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
