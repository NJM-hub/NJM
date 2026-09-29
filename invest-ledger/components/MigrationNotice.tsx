/** SQL(0002) 을 아직 실행하지 않았을 때 안내 */
export default function MigrationNotice() {
  return (
    <div className="space-y-3 text-sm text-slate-700">
      <p className="rounded-lg bg-amber-50 px-3 py-2 text-amber-900">
        로그인 기능을 쓰려면 Supabase 에서 SQL 을 <b>한 번</b> 실행해야 합니다.
      </p>
      <ol className="list-decimal space-y-1 pl-5">
        <li>GitHub 에서 <code className="rounded bg-slate-100 px-1">invest-ledger/supabase/migrations/0002_auth.sql</code> 파일을 열고 복사 아이콘(⧉)으로 전체 복사</li>
        <li>Supabase → <b>SQL Editor</b> → 새 탭(+) → 붙여넣기 → <b>Run</b></li>
        <li>&ldquo;Success&rdquo; 가 나오면 이 화면을 새로고침</li>
      </ol>
    </div>
  );
}
