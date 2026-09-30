import PageHeader from "@/components/PageHeader";
import { requirePage } from "@/lib/auth";
import { todayKst } from "@/lib/dates";

export const dynamic = "force-dynamic";

const SHEETS = [
  ["요약", "백업 일시, 건수와 총액"],
  ["투자", "모든 투자 (취소 포함) + 회수금액·미회수·연체"],
  ["고객", "고객명·연락처·메모"],
  ["회수계획", "회차별 예정일·예정금액·실제 회수·미회수·상태"],
  ["실제회수내역", "모든 입금 기록 (취소된 입금 포함, 기록한 사람)"],
  ["변경이력", "누가 언제 무엇을 바꿨는지, 변경 전/후 값"],
  ["사용자", "계정·권한·마지막 로그인"],
];

export default async function BackupPage() {
  await requirePage("admin");
  return (
    <>
      <PageHeader title="백업" description="장부 전체를 엑셀 파일 하나로 내려받습니다. 일주일에 한 번 받아 두 곳에 보관하세요." />
      <section className="card card-body">
        <a href="/backup/download" className="btn" download={`투자장부_백업_${todayKst()}.xlsx`}>
          ⬇ 백업 파일 다운로드 (투자장부_백업_{todayKst()}.xlsx)
        </a>
        <p className="mt-3 text-xs text-slate-500">
          데이터가 많으면 몇 초 걸릴 수 있습니다. 고객 이름·연락처·금액이 들어 있으니 카톡·메일로 주고받지 말고 안전한 곳에 보관하세요.
        </p>
      </section>
      <section className="card mt-5 overflow-x-auto">
        <h2 className="border-b border-slate-100 px-4 py-3 text-base font-semibold text-navy-900 sm:px-5">파일 안의 시트</h2>
        <table className="table">
          <thead><tr><th>시트</th><th>내용</th></tr></thead>
          <tbody>
            {SHEETS.map(([n, d]) => (
              <tr key={n}><td className="font-medium">{n}</td><td className="whitespace-normal">{d}</td></tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
