"use client";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-lg space-y-3 py-16 text-center">
      <div className="text-4xl">⚠️</div>
      <h1 className="text-lg font-bold">화면을 불러오지 못했습니다</h1>
      <p className="text-sm break-all text-slate-500">{error.message}</p>
      <button onClick={reset} className="btn">
        다시 시도
      </button>
    </div>
  );
}
