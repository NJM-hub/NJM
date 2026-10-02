import Link from "next/link";
import { deleteDocumentAction } from "@/app/actions/documents";
import ActionButton from "@/components/ActionButton";
import DocumentUpload from "@/components/DocumentUpload";
import { DocumentsTable } from "@/components/panels";
import { Card, PageHeader } from "@/components/ui";
import { requirePage } from "@/lib/auth";
import { DOCUMENT_CATEGORIES } from "@/lib/constants";
import { getSnapshot } from "@/lib/data";
import { q } from "@/lib/db";
import type { DocumentMeta } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function DocumentsPage({ searchParams }: { searchParams: Promise<{ property?: string; category?: string }> }) {
  const { can } = await requirePage();
  const sp = await searchParams;
  const { snap: s } = await getSnapshot();
  const props = s.properties.map((p) => p.property);
  const docs = await q<DocumentMeta & { property_name: string | null }>(
    `select d.id, d.property_id, d.unit_id, d.contract_id, d.tenant_id, d.loan_id, d.category, d.title, d.file_name, d.mime_type, d.size_bytes,
            d.created_at::text, p.name as property_name
     from documents d left join properties p on p.id = d.property_id
     where ($1::uuid is null or d.property_id = $1) and ($2::text is null or d.category = $2)
     order by d.created_at desc limit 500`,
    [sp.property && /^[0-9a-f-]{36}$/.test(sp.property) ? sp.property : null, sp.category && sp.category in DOCUMENT_CATEGORIES ? sp.category : null],
  );
  const scope = new Set(props.map((p) => p.id));
  const visible = docs.filter((d) => !d.property_id || scope.has(d.property_id));
  const groups = props.map((p) => ({ p, docs: visible.filter((d) => d.property_id === p.id) })).filter((g) => g.docs.length);
  const unassigned = visible.filter((d) => !d.property_id);
  const del = (d: DocumentMeta) => (
    <ActionButton action={deleteDocumentAction.bind(null, d.id)} className="btn-ghost !text-red-600 text-xs" confirm={`'${d.file_name}' 을(를) 삭제할까요?`}>
      삭제
    </ActionButton>
  );
  return (
    <div className="space-y-4">
      <PageHeader title="📁 문서관리" desc="임대차계약서 · 등기부등본 · 건축물대장 · 사업자등록증 · 임차인 서류 · 대출서류 · 세금 서류 (PDF/JPG/PNG)" />
      {can.editLeasing && props.length > 0 && (
        <Card title="문서 올리기">
          <DocumentUpload context={{}} properties={props.map((p) => ({ id: p.id, name: p.name }))} defaultCategory="registry" />
        </Card>
      )}
      <form className="flex flex-wrap gap-2" action="/documents">
        <select name="property" defaultValue={sp.property ?? ""} className="input !w-auto">
          <option value="">전체 부동산</option>
          {props.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <select name="category" defaultValue={sp.category ?? ""} className="input !w-auto">
          <option value="">전체 문서</option>
          {Object.entries(DOCUMENT_CATEGORIES).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <button className="btn-secondary">보기</button>
      </form>
      {groups.length === 0 && unassigned.length === 0 && <Card><p className="text-sm text-slate-500">저장된 문서가 없습니다.</p></Card>}
      {groups.map((g) => (
        <Card key={g.p.id} title={<Link href={`/properties/${g.p.id}?tab=docs`} className="hover:underline">🏢 {g.p.name}</Link>} actions={<span className="text-xs text-slate-500">{g.docs.length}개</span>}>
          <DocumentsTable docs={g.docs} canDelete={can.admin} remove={del} />
        </Card>
      ))}
      {unassigned.length > 0 && (
        <Card title="부동산 미지정 (계약서 AI 인식 후 저장 안 한 파일 등)">
          <DocumentsTable docs={unassigned} canDelete={can.admin} remove={del} />
        </Card>
      )}
    </div>
  );
}
