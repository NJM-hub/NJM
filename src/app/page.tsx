import { redirect } from "next/navigation";
import { homeOf, requireUser } from "@/lib/auth";

export default async function Home() {
  const { role } = await requireUser();
  redirect(homeOf(role));
}
