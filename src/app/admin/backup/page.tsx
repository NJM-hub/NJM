import { requireOwner } from "@/lib/auth";
import { BACKUP_TABLES, countTables } from "@/lib/backup";

export default async function BackupPage() {
  const { supabase } = await requireOwner();
  const counts = await countTables(supabase);
  const total = Object.values(counts).reduce<number>((s, n) => s + (n ?? 0), 0);

  return (
    <div className="space-y-6">
      <h1 className="page-title">백업</h1>

      <div className="card space-y-3 text-sm">
        <p className="text-gray-700">
          차량·기사·예약·배차·정산 등 저장된 자료 전체를 파일로 내려받습니다. 정산 확정 후나 한 달에 한 번 정도 받아서 PC나 클라우드 드라이브에 보관해 두세요.
        </p>
        <div className="flex flex-wrap gap-2">
          <a className="btn" href="/admin/backup/download?format=xlsx">전체 백업 (엑셀)</a>
          <a className="btn-secondary" href="/admin/backup/download?format=json">전체 백업 (JSON · 복원용)</a>
        </div>
        <ul className="list-disc pl-5 text-xs text-gray-500">
          <li>엑셀: 표마다 시트 하나씩, 눈으로 확인하거나 보관하기 좋습니다.</li>
          <li>JSON: 원본 그대로 저장돼 나중에 복원할 때 씁니다.</li>
          <li>기사 주민번호·계좌는 암호화된 상태로 저장됩니다. 파일은 외부에 공유하지 마세요.</li>
          <li>자료가 많으면 내려받기에 수십 초 걸릴 수 있습니다.</li>
        </ul>
      </div>

      <div className="card overflow-x-auto !p-0">
        <table className="table">
          <thead>
            <tr><th>자료</th><th>테이블</th><th className="text-right">건수</th></tr>
          </thead>
          <tbody>
            {BACKUP_TABLES.map((t) => (
              <tr key={t.name}>
                <td>{t.label}</td>
                <td className="text-xs text-gray-500">{t.name}</td>
                <td className="text-right">{counts[t.name] == null ? <span className="text-red-600">조회 실패</span> : counts[t.name]!.toLocaleString("ko-KR")}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="font-semibold"><td className="px-3 py-2">합계</td><td /><td className="px-3 py-2 text-right">{total.toLocaleString("ko-KR")}</td></tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
