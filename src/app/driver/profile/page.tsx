import { DriverForm } from "@/components/DriverForm";
import { requireUser } from "@/lib/auth";
import { saveMyProfile } from "./actions";

export default async function MyProfilePage() {
  const { supabase, user } = await requireUser();
  const { data: me } = await supabase
    .from("drivers")
    .select("name,phone,address,rrn_masked,bank_name,bank_account_masked,account_holder,license_number,license_expiry,status")
    .eq("id", user.id)
    .maybeSingle();

  return (
    <div>
      <h1 className="page-title">{me ? "내 정보" : "기사 정보 등록"}</h1>
      {me?.status === "pending" && <p className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">관리자 승인 대기 중입니다.</p>}
      <DriverForm action={saveMyProfile} initial={me ?? undefined} isNew={!me} submitLabel={me ? "저장" : "등록하기"} />
    </div>
  );
}
