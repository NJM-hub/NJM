-- 일정표 업로드 때 비어 있던 픽업/샌딩 구분과 차급을 원본(raw) 값으로 채운다.
-- 원본에도 없으면 주소로 판단: 도착지가 공항이면 샌딩, 출발지가 공항이면 픽업.

update public.bookings
set trip_type = case
  when raw->>'구분' ~ '샌딩|送' then '공항 샌딩'
  when raw->>'구분' ~ '픽업|接' then '공항 픽업'
end
where trip_type is null and raw ? '구분' and raw->>'구분' ~ '샌딩|送|픽업|接';

update public.bookings
set trip_type = '공항 샌딩'
where trip_type is null
  and dropoff_address ~* '공항|airport|机场|ICN|GMP'
  and coalesce(pickup_address, '') !~* '공항|airport|机场|ICN|GMP';

update public.bookings
set trip_type = '공항 픽업'
where trip_type is null
  and pickup_address ~* '공항|airport|机场|ICN|GMP'
  and coalesce(dropoff_address, '') !~* '공항|airport|机场|ICN|GMP';

update public.bookings
set vehicle_class = raw->>'차급'
where vehicle_class is null and raw ? '차급' and coalesce(raw->>'차급', '') <> '';
