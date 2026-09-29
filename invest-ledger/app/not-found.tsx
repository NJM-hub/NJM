import Link from "next/link";

export default function NotFound() {
  return (
    <div className="card card-body mx-auto max-w-md text-center">
      <h1 className="text-lg font-bold text-navy-900">페이지를 찾을 수 없습니다</h1>
      <p className="mt-2 text-sm text-slate-500">주소가 잘못되었거나 존재하지 않는 투자 건입니다.</p>
      <Link href="/investments" className="btn mt-4">투자 목록으로</Link>
    </div>
  );
}
