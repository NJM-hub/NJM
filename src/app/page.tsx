import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";

export default async function Home() {
  const { role } = await requireUser();
  redirect(role === "admin" ? "/admin" : "/driver");
}
