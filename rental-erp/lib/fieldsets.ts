// 입력 화면 필드 정의 (등록·수정 화면이 함께 사용)
import type { Field, Section } from "@/components/Form";
import {
  CONTRACT_STATUS,
  DOCUMENT_CATEGORIES,
  EXPENSE_CATEGORIES,
  PAYMENT_METHODS,
  PROPERTY_TYPES,
  RATE_TYPES,
  REPAYMENT_TYPES,
} from "@/lib/constants";

export const opts = (m: Record<string, string>) => Object.entries(m).map(([value, label]) => ({ value, label }));

export function propertySections(owners: { id: string; name: string }[], edit = false): Section[] {
  return [
    {
      title: "기본정보",
      fields: [
        ...(edit ? [{ name: "id", type: "hidden" } as Field] : []),
        { name: "name", label: "부동산명", required: true, placeholder: "예: 강남 OO빌딩" },
        { name: "property_type", label: "부동산 종류", type: "select", required: true, options: opts(PROPERTY_TYPES) },
        { name: "owner_id", label: "소유주 (개인/법인)", type: "select", options: owners.map((o) => ({ value: o.id, label: o.name })), hint: "설정 → 소유주에서 추가" },
        { name: "address", label: "주소", span: 2 },
        { name: "building_name", label: "건물명" },
      ],
    },
    {
      title: "매입 · 투자금",
      desc: "수익률·자기자본 계산에 사용",
      fields: [
        { name: "purchase_date", label: "매입일", type: "date" },
        { name: "purchase_price", label: "매입가격", type: "money" },
        { name: "current_value", label: "현재 예상가", type: "money" },
        { name: "acquisition_cost", label: "취득 관련 비용", type: "money", hint: "취득세·중개·법무비" },
        { name: "remodeling_cost", label: "리모델링 비용", type: "money" },
        { name: "other_investment", label: "기타 투자금", type: "money" },
        { name: "memo", label: "메모", type: "textarea" },
        ...(edit ? [{ name: "archived", label: "매각/정리 (목록·통계에서 제외)", type: "checkbox" } as Field] : []),
      ],
    },
  ];
}

export const unitFields = (edit: boolean): Field[] => [
  ...(edit ? [{ name: "id", type: "hidden" } as Field] : []),
  { name: "property_id", type: "hidden" },
  { name: "dong", label: "동", placeholder: "예: A" },
  { name: "floor", label: "층", placeholder: "예: 3층" },
  { name: "unit_no", label: "호실", required: true, placeholder: "예: 302호" },
  { name: "area_m2", label: "면적", suffix: "㎡" },
  { name: "expected_deposit", label: "예상 보증금 (공실 시)", type: "money" },
  { name: "expected_rent", label: "예상 월세 (공실 시)", type: "money", hint: "공실 손실 계산" },
  { name: "vacant_since", label: "공실 시작일", type: "date", hint: "비우면 마지막 계약 종료 다음 날" },
  { name: "memo", label: "메모", span: 2 },
  ...(edit ? [{ name: "inactive", label: "사용 안 함 (호실 통합·멸실)", type: "checkbox" } as Field] : []),
];

export function contractSections(
  units: { value: string; label: string }[],
  tenants: { value: string; label: string }[],
  edit: boolean,
): Section[] {
  return [
    {
      title: "목적물 · 임차인",
      fields: [
        ...(edit ? [{ name: "id", type: "hidden" } as Field] : []),
        { name: "unit_id", label: "부동산 / 호실", type: "select", required: true, options: units, span: 2 },
        { name: "contract_no", label: "계약번호", placeholder: "비우면 자동 (RC-2026-001)" },
        { name: "tenant_id", label: "임차인 (기존)", type: "select", options: tenants, hint: "목록에 없으면 아래에 새 임차인 입력" },
        { name: "new_tenant_name", label: "새 임차인 이름 / 상호" },
        { name: "new_tenant_phone", label: "새 임차인 연락처", type: "tel" },
        { name: "new_tenant_biz_no", label: "사업자등록번호" },
        { name: "landlord_name", label: "임대인" },
      ],
    },
    {
      title: "계약 기간",
      fields: [
        { name: "contract_date", label: "계약일", type: "date" },
        { name: "start_date", label: "임대차 시작일", type: "date", required: true },
        { name: "end_date", label: "임대차 종료일", type: "date", required: true },
        { name: "status", label: "계약 상태", type: "select", required: true, options: opts(CONTRACT_STATUS) },
        { name: "is_renewal", label: "갱신 계약", type: "checkbox" },
      ],
    },
    {
      title: "금액",
      fields: [
        { name: "deposit", label: "보증금", type: "money" },
        { name: "monthly_rent", label: "월세", type: "money", required: true },
        { name: "maintenance_fee", label: "관리비 (월)", type: "money" },
        { name: "vat_amount", label: "부가세 (월)", type: "money", hint: "상가·사무실 (월세의 10%)" },
        { name: "pay_day", label: "월 납부일", suffix: "일", required: true },
        { name: "billing_from", label: "자동 청구 시작 월", type: "month", hint: "과거 계약을 옮겨올 때: 이 달부터 월세 청구 생성" },
      ],
    },
    {
      title: "특약 · 메모",
      fields: [
        { name: "special_terms", label: "특약사항", type: "textarea" },
        { name: "memo", label: "메모", type: "textarea" },
      ],
    },
  ];
}

export const paymentMethodOptions = opts(PAYMENT_METHODS);
export const expenseCategoryOptions = opts(EXPENSE_CATEGORIES);
export const documentCategoryOptions = opts(DOCUMENT_CATEGORIES);

export function loanSections(properties: { value: string; label: string }[], edit: boolean): Section[] {
  return [
    {
      title: "대출 정보",
      fields: [
        ...(edit ? [{ name: "id", type: "hidden" } as Field] : []),
        { name: "property_id", label: "부동산", type: "select", required: true, options: properties },
        { name: "lender", label: "금융기관", required: true, placeholder: "예: KB국민은행" },
        { name: "product", label: "대출상품" },
        { name: "start_date", label: "대출 실행일", type: "date" },
        { name: "maturity_date", label: "만기일", type: "date" },
        { name: "interest_day", label: "이자 납부일 (매월)", suffix: "일" },
      ],
    },
    {
      title: "금액 · 금리",
      fields: [
        { name: "principal", label: "대출원금", type: "money", required: true },
        { name: "balance", label: "현재 대출잔액", type: "money", hint: "비우면 원금과 같음. 원금상환 기록 시 자동 감소" },
        { name: "interest_rate", label: "금리 (연)", suffix: "%", required: true, placeholder: "4.5" },
        { name: "rate_type", label: "금리 구분", type: "select", required: true, options: opts(RATE_TYPES) },
        { name: "repayment_type", label: "상환방식", type: "select", required: true, options: opts(REPAYMENT_TYPES) },
        { name: "monthly_payment", label: "월 상환금 (원금+이자)", type: "money", hint: "비우면 자동 계산" },
        { name: "memo", label: "메모", type: "textarea" },
        ...(edit ? [{ name: "is_closed", label: "상환 완료 (종료)", type: "checkbox" } as Field] : []),
      ],
    },
  ];
}
