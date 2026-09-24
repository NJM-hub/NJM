import { requireAdmin } from "@/lib/auth";
import { fmtDateTime } from "@/lib/format";
import { discountLabel, isExpired, type Coupon } from "@/lib/site/coupons";
import { issueCoupon } from "../coupons/actions";

type Customer = {
  id: string; name: string; phone: string; email: string | null; marketing_consent_at: string | null; created_at: string;
  customer_coupons: { id: string; used_at: string | null; coupons: { title: string } | null }[];
};

export default async function AdminCustomersPage({ searchParams }: { searchParams: Promise<{ q?: string; marketing?: string }> }) {
  const { q, marketing } = await searchParams;
  const { supabase } = await requireAdmin();
  let req = supabase.from("customers").select("id,name,phone,email,marketing_consent_at,created_at,customer_coupons(id,used_at,coupons(title))").order("created_at", { ascending: false }).limit(500);
  const term = q?.trim().replace(/[%_,()]/g, "");
  if (term) req = req.or(`name.ilike.%${term}%,phone.ilike.%${term}%,email.ilike.%${term}%`);
  if (marketing === "1") req = req.not("marketing_consent_at", "is", null);
  const [{ data }, { data: coupons }] = await Promise.all([req, supabase.from("coupons").select("*").eq("active", true).order("created_at", { ascending: false })]);
  const customers = (data ?? []) as unknown as Customer[];
  const issuable = ((coupons ?? []) as Coupon[]).filter((c) => !isExpired(c));

  return (
    <div className="space-y-4">
      <h1 className="page-title">회원 <span className="text-base font-normal text-gray-500">{customers.length}명</span></h1>
      <form className="flex flex-wrap gap-2">
        <input name="q" defaultValue={q} placeholder="이름·연락처·이메일" className="input !w-64" />
        <label className="flex items-center gap-1 text-sm"><input type="checkbox" name="marketing" value="1" defaultChecked={marketing === "1"} /> 혜택 안내 수신 동의만</label>
        <button className="btn-secondary">검색</button>
      </form>
      <div className="card overflow-x-auto !p-0">
        <table className="table">
          <thead><tr><th>이름</th><th>연락처</th><th>이메일</th><th>혜택 수신</th><th>가입일</th><th>쿠폰</th><th>쿠폰 발급</th></tr></thead>
          <tbody>
            {customers.map((c) => {
              const unused = c.customer_coupons.filter((cc) => !cc.used_at).length;
              return (
                <tr key={c.id}>
                  <td className="font-medium">{c.name}</td>
                  <td><a href={`tel:${c.phone}`} className="text-blue-600">{c.phone}</a></td>
                  <td className="text-gray-600">{c.email}</td>
                  <td>{c.marketing_consent_at ? "동의" : "-"}</td>
                  <td className="whitespace-nowrap">{fmtDateTime(c.created_at)}</td>
                  <td title={c.customer_coupons.map((cc) => cc.coupons?.title).join(", ")}>{unused} / {c.customer_coupons.length}</td>
                  <td>
                    {issuable.length > 0 && (
                      <form action={issueCoupon} className="flex gap-1">
                        <input type="hidden" name="customer_id" value={c.id} />
                        <select name="coupon_id" className="input !w-40 !py-1" required defaultValue="">
                          <option value="" disabled>쿠폰 선택</option>
                          {issuable.map((k) => <option key={k.id} value={k.id}>{k.title} ({discountLabel(k)})</option>)}
                        </select>
                        <button className="btn-secondary !px-2 !py-1">발급</button>
                      </form>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!customers.length && <p className="p-5 text-sm text-gray-500">가입한 회원이 없습니다.</p>}
      </div>
    </div>
  );
}
