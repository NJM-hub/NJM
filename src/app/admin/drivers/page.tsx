import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { SubmitButton } from "@/components/SubmitButton";
import { updateDriverStatus } from "./actions";

const STATUS = { pending: ["승인 대기", "bg-amber-100 text-amber-800"], approved: ["승인", "bg-green-100 text-green-800"], inactive: ["비활성", "bg-gray-100 text-gray-600"] } as const;

export default async function DriversPage() {
  const { supabase } = await requireAdmin();
  const [{ data: drivers }, { data: vehicles }] = await Promise.all([
    supabase.from("drivers").select("id,name,phone,email,status,vehicle_id,rrn_masked,bank_name,bank_account_masked,license_expiry,created_at").order("status").order("name"),
    supabase.from("vehicles").select("id,plate_number,model").order("plate_number"),
  ]);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-6">
      <h1 className="page-title">기사 관리</h1>
      <p className="text-sm text-gray-500">
        기사는 <b>/signup</b> 에서 직접 가입하고 신상정보를 입력합니다. 가입 링크를 기사님들께 공유하세요. 승인하고 차량을 연결해야 배차에 기사가 표시됩니다.
      </p>
      <div className="card overflow-x-auto !p-0">
        <table className="table">
          <thead>
            <tr><th>이름</th><th>연락처</th><th>상태</th><th>세무정보</th><th>면허만료</th><th>상태 / 차량</th></tr>
          </thead>
          <tbody>
            {drivers?.map((d) => {
              const [label, cls] = STATUS[d.status as keyof typeof STATUS];
              const expired = d.license_expiry && d.license_expiry < today;
              return (
                <tr key={d.id}>
                  <td><Link className="font-medium text-blue-600" href={`/admin/drivers/${d.id}`}>{d.name}</Link><div className="text-xs text-gray-500">{d.email}</div></td>
                  <td>{d.phone}</td>
                  <td><span className={`badge ${cls}`}>{label}</span></td>
                  <td className="text-xs">
                    {d.rrn_masked ? <div>{d.rrn_masked}</div> : <div className="text-red-600">주민번호 없음</div>}
                    {d.bank_account_masked ? <div className="text-gray-500">{d.bank_name} {d.bank_account_masked}</div> : <div className="text-red-600">계좌 없음</div>}
                  </td>
                  <td className={expired ? "text-red-600" : ""}>{d.license_expiry ?? "-"}{expired && " (만료)"}</td>
                  <td>
                    <form action={updateDriverStatus} className="flex flex-wrap gap-1">
                      <input type="hidden" name="id" value={d.id} />
                      <select name="status" defaultValue={d.status} className="input !w-28 !py-1 text-xs">
                        <option value="pending">승인 대기</option>
                        <option value="approved">승인</option>
                        <option value="inactive">비활성</option>
                      </select>
                      <select name="vehicle_id" defaultValue={d.vehicle_id ?? ""} className="input !w-36 !py-1 text-xs">
                        <option value="">차량 없음</option>
                        {vehicles?.map((v) => <option key={v.id} value={v.id}>{v.plate_number} {v.model ?? ""}</option>)}
                      </select>
                      <SubmitButton className="btn-secondary !px-2 !py-1 text-xs" pendingText="...">적용</SubmitButton>
                    </form>
                  </td>
                </tr>
              );
            })}
            {!drivers?.length && <tr><td colSpan={6} className="text-gray-500">가입한 기사가 없습니다.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
