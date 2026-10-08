import { redirect } from "next/navigation";
import { homeOf, requireUser } from "@/lib/auth";

/** 승인 대기 직원 */
export default async function PendingPage() {
  const { user, role } = await requireUser();
  if (role !== "staff_pending") redirect(homeOf(role));
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="card w-full max-w-sm space-y-4 text-center">
        <h1 className="text-xl font-bold">관리자 승인 대기 중</h1>
        <p className="text-sm text-gray-600">{user.email} 계정의 직원 가입을 관리자가 승인하면 이용할 수 있습니다.</p>
        <form action="/auth/signout" method="post">
          <button className="btn-secondary">로그아웃</button>
        </form>
      </div>
    </main>
  );
}
