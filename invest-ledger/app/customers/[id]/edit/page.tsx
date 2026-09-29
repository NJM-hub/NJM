import Link from "next/link";
import { notFound } from "next/navigation";
import CustomerForm from "@/components/CustomerForm";
import PageHeader from "@/components/PageHeader";
import { updateCustomerAction } from "@/app/customers/actions";
import { getCustomer } from "@/lib/queries";

import { requirePage } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function EditCustomerPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePage("staff");
  const { id } = await params;
  const c = await getCustomer(id);
  if (!c) notFound();
  return (
    <>
      <div className="mb-3">
        <Link href={`/customers/${c.id}`} className="text-sm text-navy-600 hover:underline">← {c.name}</Link>
      </div>
      <PageHeader title="고객 정보 수정" description="수정 내용은 변경 이력에 자동으로 기록됩니다." />
      <CustomerForm action={updateCustomerAction.bind(null, c.id)} customer={c} />
    </>
  );
}
