-- 청구월을 '미납으로 고정': 월을 지정하지 않은 입금(자동 배분)이 이 달을 건너뛰고 다음 달부터 채운다.
-- 예) 여러 달 치를 한 번에 입금했는데 실제로는 중간의 한 달이 미납인 경우
alter table rent_charges add column if not exists hold_unpaid boolean not null default false;
