import { notFound } from "next/navigation";
import { deleteTenantAction, saveTenantAction } from "@/app/actions/leasing";
import ActionButton from "@/components/ActionButton";
import SmartForm from "@/components/Form";
import { Card, PageHeader } from "@/components/ui";
import { requirePage } from "@/lib/auth";
import { q1 } from "@/lib/db";
import { tenantFields } from "@/lib/tenantFields";
import type { Tenant } from "@/lib/types";

export default async function EditTenantPage({ params }: { params: Promise<{ id: string }> }) {
  const { can } = await requirePage("staff");
  const { id } = await params;
  const t = await q1<Tenant>("select * from tenants where id = $1", [id]).catch(() => null);
  if (!t) notFound();
  return (
    <div className="max-w-3xl space-y-4">
      <PageHeader title={`${t.name} 수정`} />
      <Card>
        <SmartForm action={saveTenantAction} cols={2} cancelHref={`/tenants/${id}`} initial={t as unknown as Record<string, string>} sections={[{ fields: tenantFields(true) }]} />
      </Card>
      {can.admin && (
        <Card title="삭제">
          <ActionButton action={deleteTenantAction.bind(null, id)} className="btn-danger" confirm="임차인을 삭제할까요? (계약이 있으면 삭제되지 않습니다)">
            임차인 삭제
          </ActionButton>
        </Card>
      )}
    </div>
  );
}
