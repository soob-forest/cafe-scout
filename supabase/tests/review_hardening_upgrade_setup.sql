insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
) values (
  '00000000-0000-0000-0000-000000000000',
  '55555555-5555-4555-8555-555555555555',
  'authenticated', 'authenticated', 'upgrade@example.com',
  crypt('migration-test-only', gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''
);

insert into public.cafes (id, owner_id, name, region) values (
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa5',
  '55555555-5555-4555-8555-555555555555',
  '업그레이드 기존 카페',
  '테스트 지역'
);

insert into public.cafe_visits (
  id, owner_id, cafe_id, visited_at, observation_duration_minutes,
  mood_tags, customer_types, visit_purposes
) values (
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb5',
  '55555555-5555-4555-8555-555555555555',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa5',
  '2026-08-18T03:00:00.000Z', 30,
  array['작업'], array['혼자'], array['작업']
);

insert into public.cafe_business_snapshots (
  owner_id, cafe_visit_id, seat_count, current_customers,
  average_stay_minutes, estimated_average_spend, takeout_level,
  observed_takeout_orders, open_time, close_time, operating_days_per_month
) values (
  '55555555-5555-4555-8555-555555555555',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb5',
  20, 13, 60, 8000, 'NONE', 0, '10:00', '22:00', 30
);

-- Simulate derived values persisted by an older implementation. The new
-- migration must repair them even though no post-migration write occurs.
alter table public.cafe_business_snapshots disable trigger snapshots_recompute;
update public.cafe_business_snapshots
set estimated_daily_customers_base = 1,
    estimated_daily_sales_base = 1,
    estimated_monthly_sales_base = 1,
    confidence_score = 1,
    confidence_level = 'LOW'
where cafe_visit_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb5';
alter table public.cafe_business_snapshots enable trigger snapshots_recompute;

insert into public.visit_occupancy_observations (
  id, owner_id, cafe_visit_id, observed_at, current_customers, occupancy_rate
) values (
  'cccccccc-cccc-4ccc-8ccc-ccccccccccc5',
  '55555555-5555-4555-8555-555555555555',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb5',
  '2026-08-18T04:00:00.000Z', 10, 1
);
