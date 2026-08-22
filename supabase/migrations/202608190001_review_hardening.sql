-- Use integer minutes as the shared time basis so scenario rounding does not
-- depend on recurring numeric division or JavaScript binary floats.
create or replace function public.calculate_operating_minutes(p_open text, p_close text)
returns integer
language sql
immutable
strict
set search_path = ''
as $$
  select case
    when p_open = p_close then null
    else case when
      (split_part(p_close, ':', 1)::integer * 60 + split_part(p_close, ':', 2)::integer)
        > (split_part(p_open, ':', 1)::integer * 60 + split_part(p_open, ':', 2)::integer)
    then
      (split_part(p_close, ':', 1)::integer * 60 + split_part(p_close, ':', 2)::integer)
        - (split_part(p_open, ':', 1)::integer * 60 + split_part(p_open, ':', 2)::integer)
    else
      1440 - (split_part(p_open, ':', 1)::integer * 60 + split_part(p_open, ':', 2)::integer)
        + (split_part(p_close, ':', 1)::integer * 60 + split_part(p_close, ':', 2)::integer)
    end
  end
$$;

create or replace function public.calculate_operating_hours(p_open text, p_close text)
returns numeric
language sql
immutable
strict
set search_path = ''
as $$
  select public.calculate_operating_minutes(p_open, p_close)::numeric / 60
$$;

create or replace function public.recompute_business_snapshot()
returns trigger language plpgsql set search_path = '' as $$
declare
  v_observation_minutes integer;
  v_operating_minutes integer;
  v_operating_hours numeric;
  v_turns numeric;
  v_customers_per_hour numeric;
  v_takeout_multiplier_hundred integer := 100;
begin
  if new.current_customers is not null then
    new.occupancy_input_mode := 'CUSTOMERS';
    new.occupancy_rate := case when new.seat_count is null then null
      else least(100, round(new.current_customers::numeric / new.seat_count * 100)) end;
  elsif new.occupancy_rate is not null then
    new.occupancy_input_mode := 'RATE';
  else
    new.occupancy_input_mode := null;
  end if;

  v_operating_minutes := case when new.open_time is not null and new.close_time is not null
    then public.calculate_operating_minutes(new.open_time, new.close_time) else null end;
  v_operating_hours := case when v_operating_minutes is null then null
    else v_operating_minutes::numeric / 60 end;
  new.operating_hours := v_operating_hours;

  if new.observed_takeout_orders is not null then
    if new.observed_takeout_orders <= 1 then
      new.takeout_adjustment_rate := 0;
      v_takeout_multiplier_hundred := 100;
    elsif new.observed_takeout_orders <= 3 then
      new.takeout_adjustment_rate := 0.05;
      v_takeout_multiplier_hundred := 105;
    elsif new.observed_takeout_orders <= 6 then
      new.takeout_adjustment_rate := 0.10;
      v_takeout_multiplier_hundred := 110;
    elsif new.observed_takeout_orders <= 9 then
      new.takeout_adjustment_rate := 0.18;
      v_takeout_multiplier_hundred := 118;
    else
      new.takeout_adjustment_rate := 0.25;
      v_takeout_multiplier_hundred := 125;
    end if;
  elsif new.takeout_level = 'LOW' then
    new.takeout_adjustment_rate := 0.05;
    v_takeout_multiplier_hundred := 105;
  elsif new.takeout_level = 'MEDIUM' then
    new.takeout_adjustment_rate := 0.12;
    v_takeout_multiplier_hundred := 112;
  elsif new.takeout_level = 'HIGH' then
    new.takeout_adjustment_rate := 0.20;
    v_takeout_multiplier_hundred := 120;
  else
    new.takeout_adjustment_rate := 0;
    v_takeout_multiplier_hundred := 100;
  end if;

  v_turns := case when new.average_stay_minutes is null
    then null else 60::numeric / new.average_stay_minutes end;
  new.estimated_seat_turns_per_hour := v_turns;
  if new.seat_count is not null and new.occupancy_rate is not null
    and new.average_stay_minutes is not null and new.estimated_average_spend is not null
    and v_operating_minutes is not null and v_operating_minutes <= 1080
    and new.operating_days_per_month is not null then
    v_customers_per_hour := new.seat_count * (new.occupancy_rate::numeric / 100) * v_turns;
    new.estimated_customers_per_hour := v_customers_per_hour;
    new.estimated_daily_customers_low := round(
      new.seat_count::numeric * new.occupancy_rate * v_operating_minutes * 417 * v_takeout_multiplier_hundred
        / (100 * new.average_stay_minutes * 1000 * 100)
    );
    new.estimated_daily_customers_base := round(
      new.seat_count::numeric * new.occupancy_rate * v_operating_minutes * 583 * v_takeout_multiplier_hundred
        / (100 * new.average_stay_minutes * 1000 * 100)
    );
    new.estimated_daily_customers_high := round(
      new.seat_count::numeric * new.occupancy_rate * v_operating_minutes * 764 * v_takeout_multiplier_hundred
        / (100 * new.average_stay_minutes * 1000 * 100)
    );
    new.estimated_daily_sales_low := new.estimated_daily_customers_low::bigint * new.estimated_average_spend;
    new.estimated_daily_sales_base := new.estimated_daily_customers_base::bigint * new.estimated_average_spend;
    new.estimated_daily_sales_high := new.estimated_daily_customers_high::bigint * new.estimated_average_spend;
    new.estimated_monthly_sales_low := new.estimated_daily_sales_low * new.operating_days_per_month;
    new.estimated_monthly_sales_base := new.estimated_daily_sales_base * new.operating_days_per_month;
    new.estimated_monthly_sales_high := new.estimated_daily_sales_high * new.operating_days_per_month;
  else
    new.estimated_customers_per_hour := null;
    new.estimated_daily_customers_low := null;
    new.estimated_daily_customers_base := null;
    new.estimated_daily_customers_high := null;
    new.estimated_daily_sales_low := null;
    new.estimated_daily_sales_base := null;
    new.estimated_daily_sales_high := null;
    new.estimated_monthly_sales_low := null;
    new.estimated_monthly_sales_base := null;
    new.estimated_monthly_sales_high := null;
  end if;

  select observation_duration_minutes into v_observation_minutes
    from public.cafe_visits where id = new.cafe_visit_id and owner_id = new.owner_id;
  new.confidence_score := 0;
  if new.seat_count is not null then new.confidence_score := new.confidence_score + 20; end if;
  if new.current_customers is not null or new.occupancy_rate is not null then new.confidence_score := new.confidence_score + 20; end if;
  if new.estimated_average_spend is not null then new.confidence_score := new.confidence_score + 20; end if;
  if new.average_stay_minutes is not null then new.confidence_score := new.confidence_score + 15; end if;
  if new.open_time is not null and new.close_time is not null then new.confidence_score := new.confidence_score + 10; end if;
  if new.takeout_level is not null or new.observed_takeout_orders is not null then new.confidence_score := new.confidence_score + 5; end if;
  if v_observation_minutes >= 10 then new.confidence_score := new.confidence_score + 5; end if;
  if v_observation_minutes >= 30 then new.confidence_score := new.confidence_score + 5; end if;
  new.confidence_level := case when new.confidence_score < 40 then 'LOW'::public.confidence_level
    when new.confidence_score < 70 then 'MEDIUM'::public.confidence_level else 'HIGH'::public.confidence_level end;
  new.estimation_model_version := 'mvp-v1';
  return new;
end;
$$;

-- A create request carries a stable UUID in the normalized payload. Replaying
-- the same request updates the same visit and its original NEW cafe rather
-- than creating duplicate visits after an ambiguous network response.
create or replace function public.save_cafe_visit(p_payload jsonb, p_visit_id uuid default null)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
  v_create_request_id uuid := nullif(p_payload->>'_createRequestId', '')::uuid;
  v_visit_id uuid := coalesce(p_visit_id, v_create_request_id, extensions.gen_random_uuid());
  v_cafe_id uuid;
  v_old_cafe_id uuid;
  v_mode text := p_payload->>'cafeSelectionMode';
  v_idempotent_retry boolean := false;
  menu_item jsonb;
begin
  if v_owner is null then raise exception 'authentication required'; end if;

  if p_visit_id is not null then
    select cafe_id into v_old_cafe_id
    from public.cafe_visits
    where id = p_visit_id and owner_id = v_owner
    for update;
    if v_old_cafe_id is null then raise exception 'visit not found'; end if;
  elsif v_create_request_id is not null then
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(v_create_request_id::text, 0)
    );
    select cafe_id into v_old_cafe_id
    from public.cafe_visits
    where id = v_create_request_id and owner_id = v_owner
    for update;
    v_idempotent_retry := found;
  end if;

  if v_old_cafe_id is not null then
    perform 1 from public.cafes
    where id = v_old_cafe_id and owner_id = v_owner
    for update;
    if not found then raise exception 'cafe not found'; end if;
  end if;

  if v_mode = 'EXISTING' then
    select id into v_cafe_id
    from public.cafes
    where id = nullif(p_payload->>'cafeId', '')::uuid and owner_id = v_owner
    for update;
    if v_cafe_id is null then raise exception 'cafe not found'; end if;
  elsif v_mode = 'NEW' then
    if v_idempotent_retry then
      v_cafe_id := v_old_cafe_id;
      update public.cafes
      set name = trim(p_payload->>'cafeName'), region = trim(p_payload->>'region')
      where id = v_cafe_id and owner_id = v_owner;
    else
      insert into public.cafes (owner_id, name, region)
      values (v_owner, trim(p_payload->>'cafeName'), trim(p_payload->>'region'))
      returning id into v_cafe_id;
    end if;
  else
    raise exception 'invalid cafe selection mode';
  end if;

  insert into public.cafe_visits (
    id, owner_id, cafe_id, visited_at, observation_duration_minutes,
    mood_tags, customer_types, visit_purposes,
    space_rating, menu_rating, location_rating, overall_rating, strengths, adoptable_points
  ) values (
    v_visit_id, v_owner, v_cafe_id, (p_payload->>'visitedAt')::timestamptz,
    nullif(p_payload->>'observationDurationMinutes', '')::integer,
    array(select jsonb_array_elements_text(coalesce(p_payload->'moodTags', '[]'::jsonb))),
    array(select jsonb_array_elements_text(coalesce(p_payload->'customerTypes', '[]'::jsonb))),
    array(select jsonb_array_elements_text(coalesce(p_payload->'visitPurposes', '[]'::jsonb))),
    nullif(p_payload->>'spaceRating', '')::integer,
    nullif(p_payload->>'menuRating', '')::integer,
    nullif(p_payload->>'locationRating', '')::integer,
    nullif(p_payload->>'overallRating', '')::integer,
    nullif(trim(p_payload->>'strengths'), ''),
    nullif(trim(p_payload->>'adoptablePoints'), '')
  )
  on conflict (id) do update set
    cafe_id = excluded.cafe_id,
    visited_at = excluded.visited_at,
    observation_duration_minutes = excluded.observation_duration_minutes,
    mood_tags = excluded.mood_tags,
    customer_types = excluded.customer_types,
    visit_purposes = excluded.visit_purposes,
    space_rating = excluded.space_rating,
    menu_rating = excluded.menu_rating,
    location_rating = excluded.location_rating,
    overall_rating = excluded.overall_rating,
    strengths = excluded.strengths,
    adoptable_points = excluded.adoptable_points;

  delete from public.cafe_menus where cafe_visit_id = v_visit_id and owner_id = v_owner;
  for menu_item in select * from jsonb_array_elements(coalesce(p_payload->'representativeMenus', '[]'::jsonb)) loop
    insert into public.cafe_menus (owner_id, cafe_visit_id, name, category, price, is_signature, sort_order)
    values (
      v_owner, v_visit_id, trim(menu_item->>'name'), (menu_item->>'category')::public.menu_category,
      (menu_item->>'price')::integer, coalesce((menu_item->>'isSignature')::boolean, false),
      (menu_item->>'sortOrder')::integer
    );
  end loop;

  insert into public.cafe_business_snapshots (
    owner_id, cafe_visit_id, price_level, table_count, seat_count, current_customers,
    occupancy_rate, average_stay_minutes, estimated_average_spend, takeout_level,
    observed_takeout_orders, open_time, close_time, operating_days_per_month
  ) values (
    v_owner,
    v_visit_id,
    nullif(p_payload->>'priceLevel', '')::public.price_level,
    nullif(p_payload->>'tableCount', '')::integer,
    nullif(p_payload->>'seatCount', '')::integer,
    nullif(p_payload->>'currentCustomers', '')::integer,
    nullif(p_payload->>'occupancyRate', '')::integer,
    nullif(p_payload->>'averageStayMinutes', '')::integer,
    nullif(p_payload->>'estimatedAverageSpend', '')::integer,
    nullif(p_payload->>'takeoutLevel', '')::public.takeout_level,
    nullif(p_payload->>'observedTakeoutOrders', '')::integer,
    nullif(p_payload->>'openTime', ''),
    nullif(p_payload->>'closeTime', ''),
    coalesce(nullif(p_payload->>'operatingDaysPerMonth', '')::integer, 30)
  )
  on conflict (cafe_visit_id) do update set
    price_level = excluded.price_level,
    table_count = excluded.table_count,
    seat_count = excluded.seat_count,
    current_customers = excluded.current_customers,
    occupancy_rate = excluded.occupancy_rate,
    average_stay_minutes = excluded.average_stay_minutes,
    estimated_average_spend = excluded.estimated_average_spend,
    takeout_level = excluded.takeout_level,
    observed_takeout_orders = excluded.observed_takeout_orders,
    open_time = excluded.open_time,
    close_time = excluded.close_time,
    operating_days_per_month = excluded.operating_days_per_month;

  if v_old_cafe_id is not null and v_old_cafe_id <> v_cafe_id
    and not exists (select 1 from public.cafe_visits where cafe_id = v_old_cafe_id and owner_id = v_owner) then
    delete from public.cafes where id = v_old_cafe_id and owner_id = v_owner;
  end if;

  return v_visit_id;
end;
$$;

create or replace function public.delete_cafe_visit(p_visit_id uuid)
returns table (bucket text, object_path text)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
  v_cafe_id uuid;
begin
  if v_owner is null then raise exception 'authentication required'; end if;

  select cafe_id into v_cafe_id
  from public.cafe_visits
  where id = p_visit_id and owner_id = v_owner
  for update;
  if v_cafe_id is null then raise exception 'visit not found'; end if;

  perform 1 from public.cafes
  where id = v_cafe_id and owner_id = v_owner
  for update;
  if not found then raise exception 'cafe not found'; end if;

  return query select photo.bucket, photo.object_path
  from public.cafe_photos as photo
  where photo.cafe_visit_id = p_visit_id and photo.owner_id = v_owner;

  delete from public.cafe_visits where id = p_visit_id and owner_id = v_owner;
  if not exists (select 1 from public.cafe_visits where cafe_id = v_cafe_id and owner_id = v_owner) then
    delete from public.cafes where id = v_cafe_id and owner_id = v_owner;
  end if;
end;
$$;

-- Observation occupancy is derived from the visit snapshot at the database
-- boundary. FOR SHARE serializes it with concurrent seat-count corrections.
create or replace function public.recompute_occupancy_observation()
returns trigger language plpgsql set search_path = '' as $$
declare
  v_seat_count integer;
begin
  if new.current_customers is not null then
    select seat_count into v_seat_count
    from public.cafe_business_snapshots
    where cafe_visit_id = new.cafe_visit_id and owner_id = new.owner_id
    for share;
    if not found then raise exception 'visit snapshot not found'; end if;
    new.occupancy_rate := case when v_seat_count is null then null
      else least(100, round(new.current_customers::numeric / v_seat_count * 100)) end;
  end if;
  return new;
end;
$$;

drop trigger if exists observations_recompute on public.visit_occupancy_observations;
create trigger observations_recompute
before insert or update on public.visit_occupancy_observations
for each row execute function public.recompute_occupancy_observation();

create or replace function public.refresh_observations_after_seat_change()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.seat_count is distinct from old.seat_count then
    update public.visit_occupancy_observations
    set occupancy_rate = case when new.seat_count is null then null
      else least(100, round(current_customers::numeric / new.seat_count * 100)) end
    where cafe_visit_id = new.cafe_visit_id
      and owner_id = new.owner_id
      and current_customers is not null;
  end if;
  return null;
end;
$$;

drop trigger if exists snapshots_refresh_observations on public.cafe_business_snapshots;
create trigger snapshots_refresh_observations
after update of seat_count on public.cafe_business_snapshots
for each row execute function public.refresh_observations_after_seat_change();

-- Recompute rows that existed before this migration; replacing a trigger
-- function only affects later writes.
update public.cafe_business_snapshots
set seat_count = seat_count;

update public.visit_occupancy_observations as observation
set occupancy_rate = case when snapshot.seat_count is null then null
  else least(100, round(observation.current_customers::numeric / snapshot.seat_count * 100)) end
from public.cafe_business_snapshots as snapshot
where observation.cafe_visit_id = snapshot.cafe_visit_id
  and observation.owner_id = snapshot.owner_id
  and observation.current_customers is not null;
