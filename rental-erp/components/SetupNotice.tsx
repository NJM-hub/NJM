/** DB 연결/표 생성 전 안내 */
export default function SetupNotice({ error }: { error?: string }) {
  if (error === "no-url") {
    return (
      <div className="space-y-2 text-sm text-slate-700">
        <p className="font-semibold text-red-700">DB 주소가 설정되지 않았습니다.</p>
        <p>Vercel → Storage 에서 Supabase 를 연결하거나, 환경변수 <code className="rounded bg-slate-100 px-1">DATABASE_URL</code> 을 넣은 뒤 다시 배포(Redeploy)하세요.</p>
      </div>
    );
  }
  return (
    <div className="space-y-2 text-sm text-slate-700">
      <p className="font-semibold text-red-700">데이터베이스 표가 아직 없습니다.</p>
      <p>
        다시 배포(Redeploy)하면 자동으로 만들어집니다. 직접 만들려면 Supabase SQL Editor 에서 <code className="rounded bg-slate-100 px-1">rental-erp/db/migrations</code> 의 SQL 을 순서대로 실행하세요.
      </p>
      {error && <p className="text-xs break-all text-slate-500">오류: {error}</p>}
    </div>
  );
}
