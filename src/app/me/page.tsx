import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";

/** 로그인 후 역할에 맞는 화면으로 보낸다. */
export default async function Me() {
  const { role } = await requireUser();
  redirect(role === "admin" ? "/admin" : role === "customer" ? "/mypage" : "/driver");
}
