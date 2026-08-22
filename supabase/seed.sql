-- Local-only operator account: scout@example.com / cafe-scout-local
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
) values (
  '00000000-0000-0000-0000-000000000000',
  '11111111-1111-4111-8111-111111111111',
  'authenticated', 'authenticated', 'scout@example.com',
  crypt('cafe-scout-local', gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''
) on conflict (id) do nothing;

insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
values (
  '22222222-2222-4222-8222-222222222222',
  '11111111-1111-4111-8111-111111111111',
  'scout@example.com',
  '{"sub":"11111111-1111-4111-8111-111111111111","email":"scout@example.com"}',
  'email', now(), now(), now()
) on conflict (provider_id, provider) do nothing;

-- Local-only isolation test account: isolation@example.com / cafe-scout-local
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
) values (
  '00000000-0000-0000-0000-000000000000',
  '33333333-3333-4333-8333-333333333333',
  'authenticated', 'authenticated', 'isolation@example.com',
  crypt('cafe-scout-local', gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''
) on conflict (id) do nothing;

insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
values (
  '44444444-4444-4444-8444-444444444444',
  '33333333-3333-4333-8333-333333333333',
  'isolation@example.com',
  '{"sub":"33333333-3333-4333-8333-333333333333","email":"isolation@example.com"}',
  'email', now(), now(), now()
) on conflict (provider_id, provider) do nothing;

insert into public.cafes (id, owner_id, name, region) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', '11111111-1111-4111-8111-111111111111', '모서리 로스터스', '성수동'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2', '11111111-1111-4111-8111-111111111111', '오후의 정원', '연남동'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3', '11111111-1111-4111-8111-111111111111', '파도 베이크샵', '망원동');

insert into public.cafe_visits (
  id, owner_id, cafe_id, visited_at, observation_duration_minutes, mood_tags, customer_types,
  visit_purposes, space_rating, menu_rating, location_rating, overall_rating, strengths, adoptable_points
) values
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1', '11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', '2026-08-17 14:20:00+09', 35, array['작업','조용함'], array['직장인','혼자'], array['작업'], 5, 4, 4, 5, '바 동선이 짧고 좌석 간격이 안정적이다.', '주문 대기선과 픽업 동선을 분리한 점'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2', '11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2', '2026-08-15 16:40:00+09', 20, array['감성','데이트','디저트 강점'], array['커플','친구'], array['대화','디저트'], 5, 5, 4, 5, '디저트 진열과 자연광이 구매를 유도한다.', '작은 테이블을 유연하게 조합하는 방식'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb3', '11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3', '2026-08-12 11:10:00+09', null, array['테이크아웃'], array['직장인'], array['테이크아웃'], 3, 4, 5, 4, '역 출구에서 바로 보이고 주문이 빠르다.', null);

insert into public.cafe_menus (owner_id, cafe_visit_id, name, category, price, is_signature, sort_order) values
  ('11111111-1111-4111-8111-111111111111', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1', '아메리카노', 'COFFEE', 5500, false, 0),
  ('11111111-1111-4111-8111-111111111111', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1', '솔티드 크림 라떼', 'COFFEE', 7500, true, 1),
  ('11111111-1111-4111-8111-111111111111', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2', '바닐라 타르트', 'DESSERT', 8500, true, 0);

insert into public.cafe_business_snapshots (
  owner_id, cafe_visit_id, price_level, table_count, seat_count, current_customers, occupancy_rate,
  occupancy_input_mode, average_stay_minutes, estimated_average_spend, takeout_level,
  observed_takeout_orders, takeout_adjustment_rate, open_time, close_time, operating_hours,
  operating_days_per_month, estimated_seat_turns_per_hour, estimated_customers_per_hour,
  estimated_daily_customers_low, estimated_daily_customers_base, estimated_daily_customers_high,
  estimated_daily_sales_low, estimated_daily_sales_base, estimated_daily_sales_high,
  estimated_monthly_sales_low, estimated_monthly_sales_base, estimated_monthly_sales_high,
  confidence_score, confidence_level
) values
  ('11111111-1111-4111-8111-111111111111', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1', 'NORMAL', 14, 40, 30, 75, 'CUSTOMERS', 90, 9000, 'NONE', null, 0, '10:00', '22:00', 12, 30, 0.666667, 20, 100, 140, 183, 900000, 1260000, 1647000, 27000000, 37800000, 49410000, 95, 'HIGH'),
  ('11111111-1111-4111-8111-111111111111', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2', 'HIGH', 10, 28, null, 62, 'RATE', 120, 12000, 'LOW', null, 0.05, '11:00', '23:00', 12, 30, 0.5, 8.68, 46, 64, 84, 552000, 768000, 1008000, 16560000, 23040000, 30240000, 85, 'HIGH'),
  ('11111111-1111-4111-8111-111111111111', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb3', null, null, null, null, null, null, null, null, 'HIGH', 12, 0.25, null, null, null, 30, null, null, null, null, null, null, null, null, null, null, null, 10, 'LOW');

insert into public.visit_occupancy_observations (owner_id, cafe_visit_id, observed_at, current_customers, occupancy_rate) values
  ('11111111-1111-4111-8111-111111111111', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1', '2026-08-17 14:20:00+09', 31, 78),
  ('11111111-1111-4111-8111-111111111111', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1', '2026-08-17 18:50:00+09', 22, 55);
