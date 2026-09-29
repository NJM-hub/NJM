"use client";

export default function ErrorPage({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="card border-red-200 bg-red-50">
      <h2 className="text-lg font-bold text-red-800">문제가 발생했습니다</h2>
      <p className="mt-2 text-sm break-all text-red-800">{error.message}</p>
      <p className="mt-2 text-xs text-red-700">
        데이터베이스 표가 없다는 오류라면 Supabase SQL Editor 에서 supabase/migrations/0001_init.sql 을 실행했는지 확인하세요.
      </p>
      <button type="button" className="btn mt-4" onClick={reset}>
        다시 시도
      </button>
    </div>
  );
}
