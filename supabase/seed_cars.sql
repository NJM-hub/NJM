-- (선택) 홈페이지 확인용 예시 차량. 0002_site.sql 실행 후 SQL Editor 에서 실행한다.
-- 실제 차량·요금으로 바꾸려면 관리자 화면 > 홈페이지 차량에서 수정·삭제하면 된다.
insert into public.rental_cars (name, brand, category, year, fuel, seats, rent_types, daily_price, monthly_price, long_price, sort_order) values
  ('아반떼', '현대', '준중형', 2025, '가솔린', 5, '{short,rent,long,accident}', 60000, 690000, 590000, 10),
  ('쏘나타 디 엣지', '현대', '중형', 2025, 'LPG', 5, '{short,rent,long,accident}', 80000, 850000, 750000, 20),
  ('K8', '기아', '준대형', 2025, '하이브리드', 5, '{short,rent,long,accident}', 110000, 1150000, 990000, 30),
  ('그랜저', '현대', '준대형', 2025, '가솔린', 5, '{short,rent,long,accident}', 120000, 1200000, 1050000, 40),
  ('스포티지', '기아', 'SUV', 2025, '하이브리드', 5, '{short,rent,long,accident}', 100000, 1050000, 920000, 50),
  ('쏘렌토', '기아', 'SUV', 2025, '디젤', 7, '{short,rent,long,accident}', 120000, 1250000, 1090000, 60),
  ('카니발', '기아', '승합', 2025, '디젤', 9, '{short,rent,long,accident}', 150000, 1450000, 1290000, 70),
  ('아이오닉 5', '현대', '전기', 2025, '전기', 5, '{short,rent,accident}', 110000, 1100000, null, 80),
  ('모닝', '기아', '경차', 2025, '가솔린', 5, '{short,rent}', 45000, 490000, null, 90);
