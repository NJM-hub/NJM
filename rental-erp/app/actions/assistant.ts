"use server";

import { aiEnabled, askAssistant } from "@/lib/ai";
import { answerByRules } from "@/lib/assistantRules";
import { requireUser } from "@/lib/auth";
import { getSnapshot } from "@/lib/data";

export type AskState = { q: string; a: string; source: "ai" | "rules" } | { error: string } | null;

export async function askAction(_p: AskState, fd: FormData): Promise<AskState> {
  await requireUser();
  const question = String(fd.get("question") ?? "").trim().slice(0, 500);
  if (!question) return { error: "질문을 입력하세요." };
  const { ds, snap } = await getSnapshot();
  if (aiEnabled()) {
    try {
      return { q: question, a: await askAssistant(question, snap), source: "ai" };
    } catch (e) {
      const fallback = answerByRules(question, snap, ds.loans);
      if (fallback) return { q: question, a: fallback, source: "rules" };
      return { error: `AI 응답 실패: ${e instanceof Error ? e.message : String(e)}` };
    }
  }
  const a = answerByRules(question, snap, ds.loans);
  return a
    ? { q: question, a, source: "rules" }
    : { error: "이 질문은 AI 연결(ANTHROPIC_API_KEY)이 있어야 답할 수 있습니다. 아래 예시 질문은 AI 없이도 답합니다." };
}
