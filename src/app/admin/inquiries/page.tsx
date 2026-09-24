import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { fmtDateTime } from "@/lib/format";
import { SubmitButton } from "@/components/SubmitButton";
import { discountLabel } from "@/lib/site/coupons";
import { setCouponUsed } from "../coupons/actions";
import { updateInquiry } from "./actions";

const STATUS: Record<string, { label: string; cls: string }> = {
  new: { label: "신규", cls: "bg-red-100 text-red-700" },
  contacted: { label: "연락함", cls: "bg-amber-100 text-amber-700" },
  done: { label: "완료", cls: "bg-green-100 text-green-700" },
  canceled: { label: "취소", cls: "bg-gray-100 text-gray-600" },
};

type Inquiry = {
  id: string; service: string; name: string; phone: string; region: string | null; car: string | null;
  start_date: string | null; period: string | null; message: string | null; status: string; admin_memo: string | null; created_at: string;
  user_id: string | null;
  customer_coupons: { id: string; used_at: string | null; coupons: { title: string; discount_type: "amount" | "percent"; discount_value: number } | null } | null;
};

export default async function InquiriesPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams;
  const { supabase } = await requireAdmin();
  let q = supabase.from("inquiries").select("*,customer_coupons(id,used_at,coupons(title,discount_type,discount_value))").order("created_at", { ascending: false }).limit(300);
  if (status && STATUS[status]) q = q.eq("status", status);
  const { data } = await q;
  const rows = (data ?? []) as Inquiry[];

  return (
    <div className="space-y-4">
      <h1 className="page-title">상담 신청</h1>
      <div className="flex flex-wrap gap-2 text-sm">
        <Link href="/admin/inquiries" className={`rounded-full px-3 py-1 ${!status ? "bg-gray-900 text-white" : "bg-white text-gray-700 ring-1 ring-gray-200"}`}>전체</Link>
        {Object.entries(STATUS).map(([k, v]) => (
          <Link key={k} href={`/admin/inquiries?status=${k}`} className={`rounded-full px-3 py-1 ${status === k ? "bg-gray-900 text-white" : "bg-white text-gray-700 ring-1 ring-gray-200"}`}>{v.label}</Link>
        ))}
      </div>
      {rows.map((r) => {
        const st = STATUS[r.status] ?? STATUS.new;
        return (
          <div key={r.id} className="card !p-4">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className={`badge ${st.cls}`}>{st.label}</span>
              <b>{r.name}</b>
              <a href={`tel:${r.phone}`} className="text-blue-600">{r.phone}</a>
              <span className="badge bg-blue-50 text-blue-700">{r.service}</span>
              {r.user_id && <span className="badge bg-violet-50 text-violet-700">회원</span>}
              <span className="ml-auto text-xs text-gray-500">{fmtDateTime(r.created_at)}</span>
            </div>
            <p className="mt-2 text-sm text-gray-600">
              {[r.region && `지역 ${r.region}`, r.car && `차종 ${r.car}`, r.start_date && `희망일 ${r.start_date}`, r.period && `기간 ${r.period}`].filter(Boolean).join(" · ") || "추가 정보 없음"}
            </p>
            {r.message && <p className="mt-2 rounded-lg bg-gray-50 p-3 text-sm whitespace-pre-line">{r.message}</p>}
            {r.customer_coupons?.coupons && (
              <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800">
                쿠폰: <b>{r.customer_coupons.coupons.title}</b> ({discountLabel(r.customer_coupons.coupons)})
                {r.customer_coupons.used_at ? <span className="text-green-600">· 사용 처리됨</span> : null}
                <form action={setCouponUsed} className="ml-auto">
                  <input type="hidden" name="id" value={r.customer_coupons.id} />
                  <input type="hidden" name="used" value={r.customer_coupons.used_at ? "0" : "1"} />
                  <button className="text-blue-600 hover:underline">{r.customer_coupons.used_at ? "되돌리기" : "사용 처리"}</button>
                </form>
              </div>
            )}
            <form action={updateInquiry} className="mt-3 flex flex-wrap gap-2">
              <input type="hidden" name="id" value={r.id} />
              <select name="status" defaultValue={r.status} className="input !w-auto">
                {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
              <input name="admin_memo" defaultValue={r.admin_memo ?? ""} placeholder="메모" className="input min-w-0 flex-1" />
              <SubmitButton className="btn-secondary">저장</SubmitButton>
            </form>
          </div>
        );
      })}
      {!rows.length && <p className="text-sm text-gray-500">상담 신청이 없습니다.</p>}
    </div>
  );
}
