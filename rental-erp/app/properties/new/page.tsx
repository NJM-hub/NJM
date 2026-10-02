import { createPropertyAction } from "@/app/actions/properties";
import SmartForm from "@/components/Form";
import { Card, PageHeader } from "@/components/ui";
import { requirePage } from "@/lib/auth";
import { q } from "@/lib/db";
import { propertySections } from "@/lib/fieldsets";

export default async function NewPropertyPage() {
  await requirePage("admin");
  const owners = await q<{ id: string; name: string }>("select id, name from owners where is_active order by owner_type desc, name");
  return (
    <div className="max-w-4xl">
      <PageHeader title="부동산 등록" desc="부동산 1개에 여러 호실을 둘 수 있습니다. 호실마다 임차인·보증금·월세·계약기간이 따로 관리됩니다." />
      <Card>
        <SmartForm
          action={createPropertyAction}
          cancelHref="/properties"
          submitLabel="부동산 등록"
          initial={{ property_type: "commercial", owner_id: owners[0]?.id ?? "" }}
          sections={[
            ...propertySections(owners),
            {
              title: "호실",
              desc: "나중에 상세 화면에서 추가·수정할 수 있습니다",
              fields: [
                { name: "units", label: "호실 목록", span: 2, placeholder: "예: 101~105, 201호, 202호  (비우면 '전체' 1개)", hint: "쉼표로 구분, 101~105 처럼 범위 입력 가능" },
                { name: "unit_rent", label: "호실별 예상 월세", type: "money" },
                { name: "unit_deposit", label: "호실별 예상 보증금", type: "money" },
              ],
            },
          ]}
        />
      </Card>
    </div>
  );
}
