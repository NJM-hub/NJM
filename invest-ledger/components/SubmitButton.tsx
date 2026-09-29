"use client";

import { useFormStatus } from "react-dom";

export default function SubmitButton({
  children,
  className = "btn",
  pendingText = "저장 중...",
}: {
  children: React.ReactNode;
  className?: string;
  pendingText?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending}>
      {pending ? pendingText : children}
    </button>
  );
}
