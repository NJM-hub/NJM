import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { SubmitButton } from "@/components/SubmitButton";
import { eventPeriod, isEnded, type SiteEvent } from "@/lib/site/events";
import { deleteEvent, saveEvent } from "./actions";

function EventFields({ e }: { e?: SiteEvent }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {e && <input type="hidden" name="id" value={e.id} />}
      <div className="sm:col-span-2"><label className="label">제목 *</label><input name="title" defaultValue={e?.title} required className="input" placeholder="예: 월렌트 첫 달 10% 할인" /></div>
      <div className="sm:col-span-2"><label className="label">한 줄 요약</label><input name="summary" defaultValue={e?.summary ?? ""} className="input" /></div>
      <div><label className="label">시작일</label><input name="starts_on" type="date" defaultValue={e?.starts_on ?? ""} className="input" /></div>
      <div><label className="label">종료일 (비우면 상시)</label><input name="ends_on" type="date" defaultValue={e?.ends_on ?? ""} className="input" /></div>
      <div className="sm:col-span-2"><label className="label">내용</label><textarea name="body" rows={5} defaultValue={e?.body ?? ""} className="input" placeholder="대상, 혜택, 유의사항 등" /></div>
      <div>
        <label className="label">대표 이미지 {e?.image_url && "(새로 올리면 교체)"}</label>
        <input name="image" type="file" accept="image/*" className="input !py-1.5" />
        {e?.image_url && <label className="mt-1 flex items-center gap-1 text-xs text-gray-500"><input type="checkbox" name="remove_image" /> 이미지 삭제</label>}
      </div>
      <label className="flex items-center gap-2 self-end text-sm font-medium"><input type="checkbox" name="published" defaultChecked={e?.published ?? true} /> 홈페이지에 공개</label>
    </div>
  );
}

export default async function AdminEventsPage() {
  const { supabase } = await requireAdmin();
  const { data } = await supabase.from("events").select("*").order("created_at", { ascending: false });
  const events = (data ?? []) as SiteEvent[];

  return (
    <div className="space-y-6">
      <div className="flex items-baseline justify-between">
        <h1 className="page-title">이벤트</h1>
        <Link href="/events" target="_blank" className="text-sm text-blue-600 hover:underline">홈페이지에서 보기 ↗</Link>
      </div>
      <details className="card" open={!events.length}>
        <summary className="cursor-pointer font-semibold">+ 이벤트 추가</summary>
        <form action={saveEvent} className="mt-4 space-y-3">
          <EventFields />
          <SubmitButton>추가</SubmitButton>
        </form>
      </details>
      <div className="space-y-3">
        {events.map((e) => (
          <details key={e.id} className="card !p-4">
            <summary className="flex cursor-pointer flex-wrap items-center gap-3">
              <span className="font-semibold">{e.title}</span>
              <span className="text-sm text-gray-500">{eventPeriod(e)}</span>
              <span className="ml-auto flex gap-1">
                {isEnded(e) && <span className="badge bg-gray-100 text-gray-600">종료</span>}
                {!e.published && <span className="badge bg-gray-100 text-gray-600">비공개</span>}
              </span>
            </summary>
            <form action={saveEvent} className="mt-4 space-y-3">
              <EventFields e={e} />
              <SubmitButton className="btn-secondary">저장</SubmitButton>
            </form>
            <form action={deleteEvent} className="mt-2 text-right">
              <input type="hidden" name="id" value={e.id} />
              <button className="text-sm text-red-600 hover:underline">삭제</button>
            </form>
          </details>
        ))}
        {!events.length && <p className="text-sm text-gray-500">등록된 이벤트가 없습니다.</p>}
      </div>
    </div>
  );
}
