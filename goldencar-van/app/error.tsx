"use client";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-ink-900 px-4 text-center text-white">
      <h1 className="text-2xl font-bold">일시적인 문제가 생겼습니다</h1>
      <p className="mt-2 text-white/70">잠시 후 다시 시도해 주세요. 계속되면 전화로 문의해 주세요.</p>
      <button type="button" onClick={reset} className="btn-gold mt-8">
        다시 시도
      </button>
    </main>
  );
}
