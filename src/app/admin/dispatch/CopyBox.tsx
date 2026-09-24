"use client";
import { useState } from "react";

export function CopyBox({ title, text }: { title: string; text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <details className="card mt-3">
      <summary className="cursor-pointer text-sm font-medium">{title}</summary>
      <textarea readOnly value={text} className="input mt-3 h-64 font-mono text-xs" />
      <button
        type="button"
        className="btn-secondary mt-2"
        onClick={async () => {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
      >
        {copied ? "복사됨" : "복사"}
      </button>
    </details>
  );
}
