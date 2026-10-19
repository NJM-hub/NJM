-- 삭제한 청구월: 자동 청구가 이 달을 다시 만들지 않는다.
-- 예) 선불 월세라 마지막 달이 갱신 계약 쪽에 이미 포함된 경우
create table if not exists rent_charge_skips (
  contract_id uuid not null references contracts(id) on delete cascade,
  billing_month date not null,
  memo text,
  created_at timestamptz not null default now(),
  primary key (contract_id, billing_month)
);
