import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { SubmitButton } from "@/components/SubmitButton";
import { deleteVehicle, saveVehicle } from "./actions";

type Vehicle = {
  id: string; plate_number: string; model: string | null; seats: number; base_address: string | null;
  base_lat: number | null; base_lng: number | null; active: boolean; memo: string | null;
};

function VehicleFields({ v }: { v?: Vehicle }) {
  return (
    <>
      {v && <input type="hidden" name="id" value={v.id} />}
      <input name="plate_number" defaultValue={v?.plate_number} placeholder="차량번호 (예: 12가3456)" className="input" required />
      <input name="model" defaultValue={v?.model ?? ""} placeholder="차종 (예: 카니발)" className="input" />
      <input name="seats" type="number" min={1} defaultValue={v?.seats ?? 4} className="input" title="탑승 가능 인원" />
      <input name="base_address" defaultValue={v?.base_address ?? ""} placeholder="차고지 주소 (선택)" className="input" />
      <input name="base_lat" defaultValue={v?.base_lat ?? ""} placeholder="위도 (선택)" className="input" />
      <input name="base_lng" defaultValue={v?.base_lng ?? ""} placeholder="경도 (선택)" className="input" />
      <input name="memo" defaultValue={v?.memo ?? ""} placeholder="메모" className="input" />
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="active" defaultChecked={v?.active ?? true} /> 운행</label>
    </>
  );
}

export default async function VehiclesPage() {
  const { supabase } = await requireAdmin();
  const [{ data: vehicles }, { data: drivers }] = await Promise.all([
    supabase.from("vehicles").select("*").order("plate_number"),
    supabase.from("drivers").select("name,vehicle_id").not("vehicle_id", "is", null),
  ]);
  const driverOf = new Map((drivers ?? []).map((d) => [d.vehicle_id, d.name]));

  return (
    <div className="space-y-6">
      <h1 className="page-title">차량 관리</h1>
      <form action={saveVehicle} className="card grid items-center gap-2 sm:grid-cols-4 lg:grid-cols-9">
        <VehicleFields />
        <SubmitButton>추가</SubmitButton>
      </form>
      <p className="text-sm text-gray-500">
        좌석 수보다 인원이 많은 예약은 배정되지 않습니다. 차고지 좌표(또는 카카오 키가 있을 때 주소)를 넣으면 첫 콜까지의 거리도 고려합니다.
        기사 연결은 <Link className="text-blue-600" href="/admin/drivers">기사 관리</Link>에서 합니다.
      </p>
      <div className="space-y-2">
        {vehicles?.map((v) => (
          <div key={v.id} className="card !p-3">
            <form action={saveVehicle} className="grid items-center gap-2 sm:grid-cols-4 lg:grid-cols-9">
              <VehicleFields v={v as Vehicle} />
              <SubmitButton className="btn-secondary">저장</SubmitButton>
            </form>
            <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
              <span>기사: {driverOf.get(v.id) ?? "미지정"}</span>
              <form action={deleteVehicle}>
                <input type="hidden" name="id" value={v.id} />
                <button className="text-red-600 hover:underline">삭제</button>
              </form>
            </div>
          </div>
        ))}
        {!vehicles?.length && <p className="text-sm text-gray-500">등록된 차량이 없습니다.</p>}
      </div>
    </div>
  );
}
