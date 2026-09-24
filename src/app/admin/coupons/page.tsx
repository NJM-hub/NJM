import { requireAdmin } from "@/lib/auth";
import { fmtDateTime } from "@/lib/format";
import { SubmitButton } from "@/components/SubmitButton";
import { discountLabel, isExpired, type Coupon } from "@/lib/site/coupons";
import { SERVICES } from "@/lib/site/services";
import { deleteCoupon, saveCoupon, setCouponUsed } from "./actions";

type Issued = { id: string; coupon_id: string; issued_at: string; used_at: string | null; customers: { name: string; phone: string } | null };

function CouponFields({ c }: { c?: Coupon }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {c && <input type="hidden" name="id" value={c.id} />}
      <div className="sm:col-span-2"><label className="label">쿠폰 이름 *</label><input name="title" defaultValue={c?.title} required className="input" placeholder="예: 신규 회원 월렌트 5만원 할인" /></div>
      <div>
        <label className="label">할인 방식</label>
        <select name="discount_type" defaultValue={c?.discount_type ?? "amount"} className="input"><option value="amount">금액(원)</option><option value="percent">비율(%)</option></select>
      </div>
      <div><label className="label">할인 값 *</label><input name="discount_value" inputMode="numeric" required defaultValue={c?.discount_value ?? ""} className="input" placeholder="50000 또는 10" /></div>
      <div>
        <label className="label">적용 서비스</label>
        <select name="service" defaultValue={c?.service ?? ""} className="input"><option value="">전체</option>{SERVICES.map((s) => <option key={s.key} value={s.formValue}>{s.name}</option>)}</select>
      </div>
      <div><label className="label">사용 기한 (비우면 없음)</label><input name="valid_until" type="date" defaultValue={c?.valid_until ?? ""} className="input" /></div>
      <div><label className="label">쿠폰 코드 (고객 직접 등록용)</label><input name="code" defaultValue={c?.code ?? ""} className="input uppercase" placeholder="예: WELCOME2026" /></div>
      <div><label className="label">설명</label><input name="description" defaultValue={c?.description ?? ""} className="input" placeholder="사용 조건 등" /></div>
      <div className="flex flex-wrap gap-4 text-sm sm:col-span-2 lg:col-span-4">
        <label className="flex items-center gap-1"><input type="checkbox" name="issue_on_signup" defaultChecked={c?.issue_on_signup ?? false} /> 회원가입하면 자동 발급</label>
        <label className="flex items-center gap-1"><input type="checkbox" name="active" defaultChecked={c?.active ?? true} /> 사용 가능</label>
      </div>
    </div>
  );
}

export default async function AdminCouponsPage() {
  const { supabase } = await requireAdmin();
  const [{ data: coupons }, { data: issued }] = await Promise.all([
    supabase.from("coupons").select("*").order("created_at", { ascending: false }),
    supabase.from("customer_coupons").select("id,coupon_id,issued_at,used_at,customers(name,phone)").order("issued_at", { ascending: false }).limit(1000),
  ]);
  const byCoupon = new Map<string, Issued[]>();
  for (const i of (issued ?? []) as unknown as Issued[]) byCoupon.set(i.coupon_id, [...(byCoupon.get(i.coupon_id) ?? []), i]);

  return (
    <div className="space-y-6">
      <h1 className="page-title">쿠폰</h1>
      <p className="text-sm text-gray-500">
        쿠폰은 ① 회원가입 시 자동 발급, ② 고객이 마이페이지에서 코드 입력, ③ <b>회원</b> 메뉴에서 직접 발급하는 방법으로 줄 수 있습니다.
        고객이 상담 신청 때 쿠폰을 고르면 <b>상담 신청</b> 목록에 표시되며, 계약 후 사용 처리해 주세요.
      </p>
      <details className="card" open={!coupons?.length}>
        <summary className="cursor-pointer font-semibold">+ 쿠폰 만들기</summary>
        <form action={saveCoupon} className="mt-4 space-y-3">
          <CouponFields />
          <SubmitButton>만들기</SubmitButton>
        </form>
      </details>
      <div className="space-y-3">
        {((coupons ?? []) as Coupon[]).map((c) => {
          const list = byCoupon.get(c.id) ?? [];
          const used = list.filter((i) => i.used_at).length;
          return (
            <details key={c.id} className="card !p-4">
              <summary className="flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-1">
                <span className="font-semibold">{c.title}</span>
                <span className="badge bg-blue-50 text-blue-700">{discountLabel(c)}</span>
                {c.code && <code className="rounded bg-gray-100 px-1.5 text-xs">{c.code}</code>}
                {c.issue_on_signup && <span className="badge bg-green-50 text-green-700">가입 쿠폰</span>}
                {(!c.active || isExpired(c)) && <span className="badge bg-gray-100 text-gray-600">{!c.active ? "중지" : "기한 만료"}</span>}
                <span className="ml-auto text-sm text-gray-500">발급 {list.length} · 사용 {used}</span>
              </summary>
              <form action={saveCoupon} className="mt-4 space-y-3">
                <CouponFields c={c} />
                <SubmitButton className="btn-secondary">저장</SubmitButton>
              </form>
              {list.length > 0 && (
                <table className="table mt-4">
                  <thead><tr><th>고객</th><th>발급</th><th>사용</th><th /></tr></thead>
                  <tbody>
                    {list.map((i) => (
                      <tr key={i.id}>
                        <td>{i.customers?.name ?? "-"} <span className="text-gray-500">{i.customers?.phone}</span></td>
                        <td>{fmtDateTime(i.issued_at)}</td>
                        <td>{i.used_at ? fmtDateTime(i.used_at) : "-"}</td>
                        <td className="text-right">
                          <form action={setCouponUsed}>
                            <input type="hidden" name="id" value={i.id} />
                            <input type="hidden" name="used" value={i.used_at ? "0" : "1"} />
                            <button className="text-blue-600 hover:underline">{i.used_at ? "되돌리기" : "사용 처리"}</button>
                          </form>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <form action={deleteCoupon} className="mt-2 text-right">
                <input type="hidden" name="id" value={c.id} />
                <button className="text-sm text-red-600 hover:underline">삭제 (발급된 쿠폰도 함께 삭제)</button>
              </form>
            </details>
          );
        })}
        {!coupons?.length && <p className="text-sm text-gray-500">만든 쿠폰이 없습니다.</p>}
      </div>
    </div>
  );
}
