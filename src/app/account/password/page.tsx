import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { PasswordForm } from "./PasswordForm";

/** 비밀번호 변경 (관리자·직원·관리자 회원·기사 모두) */
export default async function ChangePasswordPage() {
  const { user } = await requireUser();
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 p-4">
      <p className="text-sm text-gray-500">{user.email}</p>
      <PasswordForm />
      <Link href="/" className="text-sm text-blue-700 underline">← 돌아가기</Link>
    </main>
  );
}
