import { requireOwner } from "@/lib/auth";
import { SubmitButton } from "@/components/SubmitButton";
import { setStaffApproval } from "./actions";

export default async function StaffPage() {
  const { supabase } = await requireOwner();
  const { data } = await supabase
    .from("profiles")
    .select("id,email,name,phone,role,created_at")
    .in("role", ["staff", "staff_pending"])
    .order("created_at", { ascending: false });
  const list = data ?? [];
  const pending = list.filter((p) => p.role === "staff_pending");

  return (
    <div className="space-y-6">
      <h1 className="page-title">직원 관리</h1>
      <p className="text-sm text-gray-500">
        직원 회원가입(로그인 화면 아래 &quot;직원 회원가입&quot;)으로 가입한 배차·차량 관리 직원입니다. 승인하면 로그인해서 일정표 업로드·배차·차량·기사·외부 콜을 쓸 수 있고,
        차량별 월정산·정산·세무·설정·직원 메뉴와 기사 주민번호·계좌 열람은 관리자만 쓸 수 있습니다.
      </p>
      {pending.length > 0 && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">승인 대기 {pending.length}명</p>}
      <div className="card overflow-x-auto !p-0">
        <table className="table">
          <thead><tr><th>이름</th><th>연락처</th><th>이메일</th><th>가입일</th><th>상태</th><th /></tr></thead>
          <tbody>
            {list.map((p) => (
              <tr key={p.id}>
                <td className="font-medium">{p.name ?? "-"}</td>
                <td>{p.phone ?? "-"}</td>
                <td className="text-sm">{p.email}</td>
                <td className="text-sm">{String(p.created_at).slice(0, 10)}</td>
                <td>
                  {p.role === "staff"
                    ? <span className="badge bg-green-100 text-green-800">승인됨</span>
                    : <span className="badge bg-amber-100 text-amber-800">승인 대기</span>}
                </td>
                <td>
                  <form action={setStaffApproval}>
                    <input type="hidden" name="id" value={p.id} />
                    <input type="hidden" name="approve" value={p.role === "staff" ? "0" : "1"} />
                    <SubmitButton className={p.role === "staff" ? "btn-secondary !py-1" : "btn !py-1"}>{p.role === "staff" ? "승인 취소" : "승인"}</SubmitButton>
                  </form>
                </td>
              </tr>
            ))}
            {!list.length && <tr><td colSpan={6} className="text-gray-500">가입한 직원이 없습니다.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
