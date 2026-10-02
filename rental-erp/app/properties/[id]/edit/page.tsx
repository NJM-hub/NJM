import { notFound } from "next/navigation";
import { deletePropertyAction, updatePropertyAction } from "@/app/actions/properties";
import ActionButton from "@/components/ActionButton";
import SmartForm from "@/components/Form";
import { Card, PageHeader } from "@/components/ui";
import { requirePage } from "@/lib/auth";
import { q, q1 } from "@/lib/db";
import { propertySections } from "@/lib/fieldsets";
import type { Property } from "@/lib/types";

export default async function EditPropertyPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePage("admin");
  const { id } = await params;
  const p = await q1<Property>("select * from properties where id = $1", [id]).catch(() => null);
  if (!p) notFound();
  const owners = await q<{ id: string; name: string }>("select id, name from owners order by owner_type desc, name");
  return (
    <div className="max-w-4xl space-y-4">
      <PageHeader title={`${p.name} 수정`} />
      <Card>
        <SmartForm
          action={updatePropertyAction}
          cancelHref={`/properties/${id}`}
          initial={{ ...(p as unknown as Record<string, string>), archived: !p.is_active }}
          sections={propertySections(owners, true)}
        />
      </Card>
      <Card title="삭제">
        <p className="mb-2 text-sm text-slate-600">계약 기록이 없는 부동산만 삭제할 수 있습니다. 매각한 부동산은 위에서 &apos;매각/정리&apos;를 체크하세요.</p>
        <ActionButton action={deletePropertyAction.bind(null, id)} className="btn-danger" confirm="이 부동산과 호실·대출·비용·문서가 모두 삭제됩니다. 계속할까요?">
          부동산 삭제
        </ActionButton>
      </Card>
    </div>
  );
}
