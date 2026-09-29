"use client";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const msg = error.message || "";
  const envMissing = msg.includes("환경변수");
  const tableMissing = /relation .* does not exist|Could not find the table|schema cache/i.test(msg);

  return (
    <div className="card card-body mx-auto max-w-xl">
      <h1 className="text-lg font-bold text-red-700">화면을 불러오지 못했습니다</h1>
      <p className="mt-2 break-all text-sm text-slate-700">{msg || "알 수 없는 오류"}</p>
      <div className="mt-4 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
        {envMissing && <p>👉 Supabase 주소/키 환경변수가 없습니다. README 의 &ldquo;환경변수 설정&rdquo;을 확인하세요.</p>}
        {tableMissing && <p>👉 데이터베이스 표가 아직 없습니다. Supabase SQL Editor 에서 supabase/migrations/0001_init.sql 을 실행하세요.</p>}
        {!envMissing && !tableMissing && (
          <ul className="list-disc space-y-1 pl-5">
            <li>Vercel 환경변수(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)를 넣은 뒤 다시 배포(Redeploy)했나요?</li>
            <li>Supabase SQL Editor 에서 supabase/migrations/0001_init.sql 을 실행했나요?</li>
            <li>둘 다 했다면 Vercel → 프로젝트 → Logs 에서 자세한 오류를 확인하세요.</li>
          </ul>
        )}
        {error.digest && <p className="mt-1 text-xs text-slate-400">오류 코드: {error.digest}</p>}
      </div>
      <button onClick={reset} className="btn mt-4">다시 시도</button>
    </div>
  );
}
