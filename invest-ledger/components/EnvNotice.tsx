/** 환경변수가 없을 때 보여주는 안내 화면 */
export default function EnvNotice({ missing }: { missing: string[] }) {
  return (
    <div className="card border-amber-300 bg-amber-50">
      <h2 className="text-lg font-bold text-amber-900">환경변수 설정이 필요합니다</h2>
      <p className="mt-2 text-sm text-amber-900">아래 값이 설정되지 않아 데이터베이스에 연결할 수 없습니다.</p>
      <ul className="mt-3 list-disc pl-5 font-mono text-sm text-amber-900">
        {missing.map((m) => (
          <li key={m}>{m}</li>
        ))}
      </ul>
      <p className="mt-3 text-sm text-amber-900">
        내 컴퓨터에서는 <code>.env.local</code> 파일에, Vercel 에서는 Project Settings → Environment Variables 에
        입력한 뒤 다시 실행(재배포)하세요. 자세한 방법은 README 를 참고하세요.
      </p>
    </div>
  );
}
