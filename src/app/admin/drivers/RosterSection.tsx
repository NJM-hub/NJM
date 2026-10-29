import type { SupabaseClient } from "@supabase/supabase-js";
import { ReadOnly } from "@/components/ReadOnly";
import { SubmitButton } from "@/components/SubmitButton";
import { todayKst } from "@/lib/format";
import { ledgerMonths } from "@/lib/settlement/monthlyLedger";
import { deleteRosterDriver, saveRosterDriver } from "./rosterActions";

type Vehicle = { id: string; plate_number: string };
type Roster = {
  id: string; name: string; vehicle_id: string | null; phone: string | null; rrn_masked: string | null; bank_name: string | null;
  bank_account_masked: string | null; account_holder: string | null; active: boolean; memo: string | null; name_zh: string | null;
};

/** jiip: 지입 기사 명단의 새 기사 입력 줄 (메모에 "지입"을 넣어 저장) */
function RosterRow({ r, vehicles, jiip = false }: { r?: Roster; vehicles: Vehicle[]; jiip?: boolean }) {
  const f = r ? `roster-${r.id}` : jiip ? "roster-new-jiip" : "roster-new";
  return (
    <tr className={r ? (r.active ? "" : "opacity-50") : "bg-gray-50"}>
      <td><input form={f} name="name" defaultValue={r?.name ?? ""} required placeholder="이름" className="input !w-28" /></td>
      <td><input form={f} name="name_zh" defaultValue={r?.name_zh ?? ""} placeholder="中文名" className="input !w-24" /></td>
      <td>
        <select form={f} name="vehicle_id" defaultValue={r?.vehicle_id ?? ""} className="input !w-32">
          <option value="">차량 없음</option>
          {vehicles.map((v) => <option key={v.id} value={v.id}>{v.plate_number}</option>)}
        </select>
      </td>
      <td><input form={f} name="phone" defaultValue={r?.phone ?? ""} placeholder="010-" className="input !w-32" /></td>
      <td><input form={f} name="rrn" placeholder={r?.rrn_masked ?? "000000-0000000"} className="input !w-40" autoComplete="off" /></td>
      <td><input form={f} name="bank_name" defaultValue={r?.bank_name ?? ""} placeholder="은행" className="input !w-24" /></td>
      <td><input form={f} name="bank_account" placeholder={r?.bank_account_masked ?? "계좌번호"} className="input !w-40" autoComplete="off" /></td>
      <td><input form={f} name="account_holder" defaultValue={r?.account_holder ?? ""} placeholder="예금주" className="input !w-24" /></td>
      <td><input form={f} name="memo" defaultValue={r?.memo ?? (jiip ? "지입" : "")} placeholder="메모" className="input !w-32" /></td>
      <td className="whitespace-nowrap">
        <form id={f} action={saveRosterDriver} className="inline">
          {r && <input type="hidden" name="id" value={r.id} />}
          {!r && jiip && <input type="hidden" name="jiip" value="1" />}
          {r && (
            <select name="active" defaultValue={r.active ? "on" : "off"} className="input !w-20 !py-1 text-xs">
              <option value="on">근무</option>
              <option value="off">퇴사</option>
            </select>
          )}
          <SubmitButton className={r ? "btn-secondary ml-1 !px-2 !py-1 text-xs" : "btn !py-1"} pendingText="...">{r ? "저장" : "추가"}</SubmitButton>
        </form>
        {r && (
          <form action={deleteRosterDriver} className="ml-1 inline">
            <input type="hidden" name="id" value={r.id} />
            <SubmitButton className="btn-secondary !px-2 !py-1 text-xs text-red-600" pendingText="...">삭제</SubmitButton>
          </form>
        )}
      </td>
    </tr>
  );
}

/** 메모에 "지입"이라고 적힌 기사는 지입 기사 명단으로 따로 */
const isJiip = (r: Roster) => /지입/.test(r.memo ?? "");

/** 소속 기사 명단 + 월별 지급표 바로가기 (관리자만 수정, 관리자 회원·직원은 보기만. 지급표는 직원 제외) */
export async function RosterSection({ db, vehicles, readOnly = false, showPay = true }: { db: SupabaseClient; vehicles: Vehicle[]; readOnly?: boolean; showPay?: boolean }) {
  const [{ data }, months] = await Promise.all([
    db.from("driver_roster").select("id,name,name_zh,vehicle_id,phone,rrn_masked,bank_name,bank_account_masked,account_holder,active,memo").order("active", { ascending: false }).order("name"),
    showPay ? ledgerMonths(db) : Promise.resolve([] as string[]),
  ]);
  const roster = (data ?? []) as Roster[];
  return (
    <>
      {showPay && <form action="/admin/drivers/pay" className="card flex flex-wrap items-end gap-3">
        <div>
          <label className="label" htmlFor="pay-month">기사 지급표 월</label>
          <input id="pay-month" type="month" name="month" defaultValue={months[0] ?? todayKst().slice(0, 7)} required className="input" />
        </div>
        <button className="btn-secondary">조회</button>
        <p className="text-xs text-gray-500">그 달 정산 기사별 차량·이름·주민번호·계좌번호·지급액을 봅니다 (아래 명단과 이름으로 맞춥니다).</p>
      </form>}

      <ReadOnly on={readOnly}>
      {([
        ["소속 기사 명단", roster.filter((r) => !isJiip(r)), false],
        ["지입 기사 명단", roster.filter(isJiip), true],
      ] as const).map(([title, list, jiipList]) => (
        <div key={title} className="card overflow-x-auto !p-0">
          <div className="px-4 pt-4">
            <div className="font-semibold">{title} ({list.filter((r) => r.active).length}명)</div>
            <p className="mt-1 text-xs text-gray-500">
              {!jiipList
                ? readOnly
                  ? "보기 전용입니다 (명단 수정은 관리자만). 주민번호·계좌번호는 일부만 보입니다."
                  : "주민번호·계좌번호는 암호화해서 저장되고 목록에는 일부만 보입니다. 바꿀 때만 새로 입력하세요 (비워 두면 기존 값 유지)."
                : "메모에 \"지입\"이라고 적힌 기사입니다. 아래 줄에서 바로 추가할 수 있고, 메모에서 \"지입\"을 지우면 소속 기사 명단으로 옮겨집니다."}
            </p>
          </div>
          <table className="table mt-2">
            <thead>
              <tr><th>이름</th><th>중국어 이름</th><th>차량</th><th>연락처</th><th>주민번호</th><th>은행</th><th>계좌번호</th><th>예금주</th><th>메모</th><th /></tr>
            </thead>
            <tbody>
              {list.map((r) => <RosterRow key={r.id} r={r} vehicles={vehicles} />)}
              {!readOnly && <RosterRow vehicles={vehicles} jiip={jiipList} />}
            </tbody>
          </table>
        </div>
      ))}
      </ReadOnly>
    </>
  );
}
