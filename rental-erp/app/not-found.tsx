import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-lg space-y-3 py-16 text-center">
      <div className="text-4xl">🔍</div>
      <h1 className="text-lg font-bold">찾을 수 없습니다</h1>
      <Link href="/" className="btn">
        대시보드로
      </Link>
    </div>
  );
}
