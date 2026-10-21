"use client";

// 차량 카드의 '문의' 버튼: 예약 양식으로 이동하면서 해당 차량을 자동 선택합니다.
export const SELECT_VEHICLE_EVENT = "goldencar:select-vehicle";

export default function SelectVehicleLink({
  vehicleId,
  className,
  children,
}: {
  vehicleId: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href="#reserve"
      className={className}
      onClick={() => window.dispatchEvent(new CustomEvent(SELECT_VEHICLE_EVENT, { detail: vehicleId }))}
    >
      {children}
    </a>
  );
}
