import { requireAdmin } from "@/lib/auth";
import { loadSettings } from "@/lib/settings";
import { SubmitButton } from "@/components/SubmitButton";
import { saveSettings } from "./actions";

export default async function SettingsPage() {
  const { supabase } = await requireAdmin();
  const s = await loadSettings(supabase);
  const kakao = !!process.env.KAKAO_REST_API_KEY;

  return (
    <form action={saveSettings} className="max-w-3xl space-y-6">
      <h1 className="page-title">설정</h1>
      <section className="card grid gap-4 sm:grid-cols-2">
        <h2 className="font-semibold sm:col-span-2">배차 규칙</h2>
        <F name="max_calls_per_vehicle" label="차량당 최대 콜 수" value={s.max_calls_per_vehicle} />
        <F name="buffer_min" label="콜 사이 여유시간(분)" value={s.buffer_min} help="하차 후 다음 픽업까지 이동시간 외 추가 여유" />
        <F name="default_duration_min" label="기본 운행 시간(분)" value={s.default_duration_min} help="일정표에 소요시간/종료시간/상품명 시간 정보가 없을 때" />
        <F name="avg_speed_kmh" label="평균 속도(km/h)" value={s.avg_speed_kmh} />
        <F name="road_factor" label="도로거리 보정계수" value={s.road_factor} step="0.1" help="직선거리 × 계수 = 예상 주행거리" />
        <F name="unknown_travel_min" label="좌표 없을 때 이동시간(분)" value={s.unknown_travel_min} help="주소를 좌표로 못 바꾼 경우 가정하는 이동시간" />
        <p className="text-sm sm:col-span-2">
          카카오 주소→좌표 변환: {kakao ? <span className="text-green-700">사용 중</span> : <span className="text-amber-700">미설정 (환경변수 KAKAO_REST_API_KEY 를 넣으면 거리 기반 배차가 정확해집니다)</span>}
        </p>
      </section>
      <section className="card grid gap-4 sm:grid-cols-2">
        <h2 className="font-semibold sm:col-span-2">정산 · 세무</h2>
        <F name="fare_per_call" label="콜 기본 금액(원)" value={s.fare_per_call} help="일정표에 기사 지급액 컬럼이 있으면 그 값 우선. 정산 화면에서 건별 수정 가능" />
        <F name="fare_gimpo" label="김포공항 콜 금액(원)" value={s.fare_gimpo ?? 37000} />
        <F name="fare_picket_extra" label="피켓(공항 미팅) 추가금(원)" value={s.fare_picket_extra ?? 5000} help="KKday 추가 서비스 '공항에서 픽업' 또는 메모에 피켓이 있는 콜" />
        <F name="own_call_fee" label="외부오더(자체 콜) 1건당 차감액(원)" value={s.own_call_fee ?? 15000} help="차량별 월정산에서 기사가 직접 받은 콜마다 빼는 금액" />
        <F name="business_code" label="업종코드 (간이지급명세서)" value={s.business_code} help="기본 940909(기타자영업). 세무사와 확인 후 변경" />
        <F name="income_tax_rate_pct" label="소득세율(%)" value={s.income_tax_rate * 100} step="0.1" />
        <F name="local_tax_rate_pct" label="지방소득세(소득세 대비 %)" value={s.local_tax_rate * 100} step="1" />
        <F name="company_name" label="지급자 상호" value={s.company_name ?? ""} />
        <F name="company_brn" label="지급자 사업자등록번호" value={s.company_brn ?? ""} />
      </section>
      <SubmitButton>저장</SubmitButton>
    </form>
  );
}

function F({ name, label, value, step, help }: { name: string; label: string; value: string | number; step?: string; help?: string }) {
  return (
    <div>
      <label className="label" htmlFor={name}>{label}</label>
      <input id={name} name={name} defaultValue={value} step={step ?? "1"} type={typeof value === "number" ? "number" : "text"} className="input" />
      {help && <p className="mt-1 text-xs text-gray-500">{help}</p>}
    </div>
  );
}
