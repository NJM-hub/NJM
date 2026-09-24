"use client";
import { useFormStatus } from "react-dom";

export function SubmitButton({ children, pendingText, className = "btn" }: { children: React.ReactNode; pendingText?: string; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending}>
      {pending ? pendingText ?? "처리 중..." : children}
    </button>
  );
}
