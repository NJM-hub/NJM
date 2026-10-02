import { saveTenantAction } from "@/app/actions/leasing";
import SmartForm from "@/components/Form";
import { Card, PageHeader } from "@/components/ui";
import { requirePage } from "@/lib/auth";
import { tenantFields } from "@/lib/tenantFields";

export default async function NewTenantPage() {
  await requirePage("staff");
  return (
    <div className="max-w-3xl">
      <PageHeader title="임차인 등록" desc="계약 등록 화면에서 바로 새 임차인을 입력할 수도 있습니다." />
      <Card>
        <SmartForm action={saveTenantAction} cols={2} cancelHref="/tenants" sections={[{ fields: tenantFields(false) }]} />
      </Card>
    </div>
  );
}
