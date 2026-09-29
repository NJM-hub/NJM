import Link from "next/link";

export default function NotFound() {
  return (
    <div className="card py-12 text-center">
      <p className="text-lg font-semibold text-navy-900">페이지를 찾을 수 없습니다</p>
      <Link href="/" className="btn mt-4">
        대시보드로
      </Link>
    </div>
  );
}
