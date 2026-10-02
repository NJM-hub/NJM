import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import * as z from "zod/v4";
import type { Snapshot } from "@/lib/engine";
import { PROPERTY_TYPES, label } from "@/lib/constants";

// Claude API 사용: ANTHROPIC_API_KEY 환경변수가 있을 때만 동작한다.
// - 계약서 OCR: PDF/이미지를 읽어 계약 정보를 구조화된 JSON 으로 추출
// - AI 질문: 대시보드 계산 결과를 근거로 대표자의 질문에 답변
const MODEL = "claude-opus-5-5";

export function aiEnabled(): boolean {
  return !!(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}

function client() {
  return new Anthropic({ timeout: 120_000, maxRetries: 2 });
}

// 거절(refusal)되면 다른 모델로 자동 재시도 (서버 측 fallback)
const FALLBACK = {
  betas: ["server-side-fallback-2026-07-01"],
  fallbacks: "default" as const,
};

// ---------------------------------------------------------------------------
// 계약서 OCR
// ---------------------------------------------------------------------------

export const ContractExtraction = z.object({
  landlord_name: z.string().nullable().describe("임대인 이름 또는 상호"),
  tenant_name: z.string().nullable().describe("임차인 이름 또는 상호"),
  tenant_phone: z.string().nullable().describe("임차인 연락처"),
  tenant_biz_no: z.string().nullable().describe("임차인 사업자등록번호 (000-00-00000)"),
  property_description: z.string().nullable().describe("임대차 목적물 (건물명, 용도, 면적 등)"),
  address: z.string().nullable().describe("소재지 주소"),
  unit_no: z.string().nullable().describe("호실 (예: 302호)"),
  contract_date: z.string().nullable().describe("계약일 YYYY-MM-DD"),
  start_date: z.string().nullable().describe("임대차 시작일 YYYY-MM-DD"),
  end_date: z.string().nullable().describe("임대차 종료일 YYYY-MM-DD"),
  deposit: z.number().nullable().describe("보증금 (원, 숫자)"),
  monthly_rent: z.number().nullable().describe("월세 차임 (원, 부가세 제외)"),
  maintenance_fee: z.number().nullable().describe("월 관리비 (원)"),
  vat_amount: z.number().nullable().describe("월 부가세 (원). '부가세 별도'이고 금액이 없으면 월세의 10%"),
  vat_note: z.string().nullable().describe("부가세 관련 문구 그대로 (포함/별도)"),
  pay_day: z.number().nullable().describe("월 납부일 (1~31)"),
  contract_period_text: z.string().nullable().describe("계약기간 문구 (예: 24개월)"),
  special_terms: z.string().nullable().describe("특약사항 전문"),
  is_renewal: z.boolean().nullable().describe("갱신 계약이면 true"),
  confidence_notes: z.string().nullable().describe("읽기 어렵거나 확신이 없는 항목 설명"),
});
export type ContractExtraction = z.infer<typeof ContractExtraction>;

const OCR_PROMPT = `첨부한 한국 부동산 임대차계약서(상가/주택/사무실)에서 계약 정보를 추출하세요.
- 금액은 '일금 오천만원정(₩50,000,000)'처럼 한글과 숫자가 함께 있으면 숫자를 기준으로 원 단위 정수로 적습니다.
- 날짜는 YYYY-MM-DD 로 바꿉니다. 종료일이 없고 기간(예: 24개월)만 있으면 시작일 기준으로 계산합니다.
- 납부일은 '매월 25일' 같은 문구에서 숫자만.
- 계약서에 없는 항목은 null. 추측한 값은 confidence_notes 에 적어 주세요.
- 특약사항은 원문을 최대한 그대로 옮깁니다.`;

export async function extractContract(file: { mime: string; base64: string }): Promise<ContractExtraction> {
  const source =
    file.mime === "application/pdf"
      ? ({ type: "document", source: { type: "base64", media_type: "application/pdf", data: file.base64 } } as const)
      : ({
          type: "image",
          source: { type: "base64", media_type: file.mime as "image/jpeg" | "image/png" | "image/webp", data: file.base64 },
        } as const);

  const res = await client().beta.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    ...FALLBACK,
    thinking: { type: "adaptive" },
    output_config: { effort: "medium", format: betaZodOutputFormat(ContractExtraction) },
    messages: [{ role: "user", content: [source, { type: "text", text: OCR_PROMPT }] }],
  });
  if (res.stop_reason === "refusal") throw new Error("AI 가 이 문서를 처리하지 못했습니다. 직접 입력해 주세요.");
  if (!res.parsed_output) throw new Error("계약서 내용을 읽지 못했습니다. 더 선명한 파일로 다시 시도하거나 직접 입력해 주세요.");
  return res.parsed_output;
}

// ---------------------------------------------------------------------------
// AI 질문 (대표자용)
// ---------------------------------------------------------------------------

/** AI 에게 넘기는 데이터: 계산이 끝난 숫자만 간결하게 (개인정보는 이름·호실 정도만) */
export function snapshotForAI(s: Snapshot) {
  return {
    기준일: s.today,
    계산기준: {
      월순수익식: s.settings.formulas.monthlyNet,
      자기자본식: s.settings.formulas.equity,
      운영비: `최근 ${s.settings.opexMonths}개월 실제 비용(대출이자 제외) 월평균`,
      월이자: "대출잔액 × 금리 ÷ 12",
    },
    전체: s.totals,
    부동산: s.properties.map((p) => ({
      이름: p.property.name,
      소유: p.owner ? `${p.owner.name}(${p.owner.owner_type === "corporation" ? "법인" : "개인"})` : null,
      종류: label(PROPERTY_TYPES, p.property.property_type),
      주소: p.property.address,
      매입가격: p.property.purchase_price,
      투자총액: p.investedTotal,
      호실수: p.unitCount,
      공실수: p.vacantCount,
      보증금: p.deposits,
      월세: p.monthlyRent,
      기타수입: p.otherIncome,
      대출잔액: p.loanBalance,
      월이자: p.monthlyInterest,
      월운영비: p.monthlyOpex,
      월순수익: p.monthlyNet,
      연순수익: p.annualNet,
      자기자본: p.equity,
      단순임대수익률: p.simpleYield,
      대출이자반영수익률_자기자본수익률: p.leveragedYield,
      실제현금수익률: p.cashYield,
      미납: p.unpaid,
      호실: p.units.map((u) => ({
        호실: u.unit.unit_no,
        임차인: u.tenant?.name ?? null,
        월세: u.contract?.monthly_rent ?? null,
        보증금: u.contract?.deposit ?? null,
        계약종료: u.contract?.end_date ?? null,
        공실일수: u.occupied ? null : u.vacancyDays,
        공실예상월세: u.occupied ? null : u.unit.expected_rent,
      })),
    })),
    미납: s.arrears.map((a) => ({
      임차인: a.tenant?.name,
      위치: `${a.property?.name} ${a.unit?.unit_no}`,
      미납액: a.total,
      미납개월: a.charges.length,
      경과일: a.days,
    })),
    만료예정: s.expiring.map((e) => ({
      임차인: e.tenant?.name,
      위치: `${e.property?.name} ${e.unit?.unit_no}`,
      종료일: e.contract.end_date,
      남은일: e.daysLeft,
    })),
    대출만기임박: s.loansDue.map((l) => ({ 은행: l.loan.lender, 부동산: l.property?.name, 만기: l.loan.maturity_date, 잔액: l.loan.balance })),
    월별추이: s.monthly.map((m) => ({ 월: m.month.slice(0, 7), 청구: m.billed, 입금: m.collected, 비용: m.expenses, 이자: m.interest, 순현금: m.net })),
  };
}

const ASSISTANT_SYSTEM = `당신은 임대사업 대표자를 돕는 재무 비서입니다. 사용자 메시지에 포함된 JSON 데이터(이 회사의 실제 장부를 계산한 결과)만 근거로 답합니다.
- 한국어로, 결론(숫자)을 첫 문장에 씁니다. 금액은 1,850만원 / 8.5억원처럼 읽기 쉽게.
- 계산이 필요하면(예: 월세 5% 인상, 금리 1%p 상승) 데이터로 직접 계산하고 계산식을 한 줄로 보여줍니다.
- 데이터에 없는 내용은 추측하지 말고 "장부에 없는 정보"라고 말합니다.
- 3~6줄 이내로 간결하게. 표가 도움이 되면 짧은 마크다운 목록을 씁니다.`;

export async function askAssistant(question: string, s: Snapshot): Promise<string> {
  const data = JSON.stringify(snapshotForAI(s));
  const res = await client().beta.messages.create({
    model: MODEL,
    max_tokens: 16000,
    ...FALLBACK,
    thinking: { type: "adaptive" },
    output_config: { effort: "medium" },
    system: ASSISTANT_SYSTEM,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: `<장부데이터>\n${data}\n</장부데이터>` },
          { type: "text", text: question },
        ],
      },
    ],
  });
  if (res.stop_reason === "refusal") return "이 질문에는 답할 수 없습니다. 질문을 바꿔 다시 시도해 주세요.";
  const text = res.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
  return text || "답변을 만들지 못했습니다.";
}
