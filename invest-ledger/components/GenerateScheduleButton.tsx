"use client";

import { useActionState } from "react";
import SubmitButton from "@/components/SubmitButton";
import type { FormState } from "@/lib/types";

export default function GenerateScheduleButton({
  action,
  label,
  confirmText,
  className = "btn",
}: {
  action: (prev: FormState, fd: FormData) => Promise<FormState>;
  label: string;
  confirmText?: string;
  className?: string;
}) {
  const [state, formAction] = useActionState(action, {} as FormState);
  return (
    <form action={formAction} onSubmit={(e) => { if (confirmText && !confirm(confirmText)) e.preventDefault(); }}>
      <SubmitButton className={className} pendingText="만드는 중...">{label}</SubmitButton>
      {state.error && <p className="field-error mt-2">{state.error}</p>}
    </form>
  );
}
