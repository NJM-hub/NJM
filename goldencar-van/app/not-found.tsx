import Link from "next/link";
export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-ink-900 px-4 text-center text-white">
      <p className="eyebrow">404</p>
      <h1 className="mt-3 text-2xl font-bold">페이지를 찾을 수 없습니다</h1>
      <p className="mt-2 text-white/70">주소가 바뀌었거나 없는 페이지입니다.</p>
      <Link href="/" className="btn-gold mt-8">
        홈으로 가기
      </Link>
    </main>
  );
}
