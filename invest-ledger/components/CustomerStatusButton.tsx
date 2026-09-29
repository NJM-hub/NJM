"use client";

import { useActionState } from "react";
import SubmitButton from "@/components/SubmitButton";
import type { FormState } from "@/lib/types";

export default function CustomerStatusButton({
  action,
  active,
}: {
  action: () => Promise<FormState>;
  active: boolean;
}) {
  const [state, formAction] = useActionState(action, {} as FormState);
  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        const text = active
          ? "이 고객을 '미사용'으로 바꿀까요?\n데이터는 지워지지 않고, 투자 등록 화면의 고객 선택 목록에서만 빠집니다."
          : "이 고객을 다시 '사용'으로 바꿀까요?";
        if (!confirm(text)) e.preventDefault();
      }}
    >
      <SubmitButton className="btn-secondary" pendingText="처리 중...">{active ? "미사용으로 변경" : "사용으로 변경"}</SubmitButton>
      {state.error && <p className="field-error">{state.error}</p>}
    </form>
  );
}
