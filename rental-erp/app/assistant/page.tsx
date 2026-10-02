import { askAction } from "@/app/actions/assistant";
import Assistant from "@/components/Assistant";
import { PageHeader } from "@/components/ui";
import { aiEnabled } from "@/lib/ai";
import { SAMPLE_QUESTIONS } from "@/lib/assistantRules";
import { requirePage } from "@/lib/auth";

export default async function AssistantPage() {
  await requirePage();
  return (
    <div className="max-w-3xl">
      <PageHeader title="✨ AI 질문" desc="장부 데이터(계산된 숫자)를 근거로 답합니다. 수익·미납·만료·대출·시뮬레이션 질문을 해보세요." />
      <Assistant action={askAction} samples={SAMPLE_QUESTIONS} aiOn={aiEnabled()} />
    </div>
  );
}
