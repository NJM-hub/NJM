import { notFound } from "next/navigation";
import { DriverForm } from "@/components/DriverForm";
import { requireAdmin } from "@/lib/auth";
import { fmtDateTime } from "@/lib/format";
import { adminUpdateDriver } from "../actions";
import { RevealPii } from "./RevealPii";

export default async function DriverDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireAdmin();
  const { data: d } = await supabase
    .from("drivers")
    .select("id,name,phone,email,address,rrn_masked,bank_name,bank_account_masked,account_holder,license_number,license_expiry,status,privacy_consent_at,third_party_consent_at,created_at")
    .eq("id", id)
    .maybeSingle();
  if (!d) notFound();

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="page-title">{d.name} <span className="text-base font-normal text-gray-500">{d.email}</span></h1>
      <div className="card space-y-2 text-sm">
        <div>가입: {fmtDateTime(d.created_at)} · 개인정보 동의: {fmtDateTime(d.privacy_consent_at)} · 제3자 제공 동의: {d.third_party_consent_at ? fmtDateTime(d.third_party_consent_at) : "미동의"}</div>
        <RevealPii id={d.id} />
      </div>
      <DriverForm action={adminUpdateDriver.bind(null, d.id)} initial={d} isNew={false} />
    </div>
  );
}
