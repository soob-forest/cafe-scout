create or replace function public.save_cafe_visit(p_payload jsonb, p_visit_id uuid default null)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
  v_visit_id uuid := coalesce(p_visit_id, extensions.gen_random_uuid());
  v_cafe_id uuid;
  v_old_cafe_id uuid;
  v_mode text := p_payload->>'cafeSelectionMode';
  v_seat integer := nullif(p_payload->>'seatCount', '')::integer;
  v_current integer := nullif(p_payload->>'currentCustomers', '')::integer;
  v_manual_occupancy integer := nullif(p_payload->>'occupancyRate', '')::integer;
  v_occupancy integer;
  v_stay integer := nullif(p_payload->>'averageStayMinutes', '')::integer;
  v_spend integer := nullif(p_payload->>'estimatedAverageSpend', '')::integer;
  v_open text := nullif(p_payload->>'openTime', '');
  v_close text := nullif(p_payload->>'closeTime', '');
  v_days integer := coalesce(nullif(p_payload->>'operatingDaysPerMonth', '')::integer, 30);
  v_takeout public.takeout_level := nullif(p_payload->>'takeoutLevel', '')::public.takeout_level;
  v_takeout_orders integer := nullif(p_payload->>'observedTakeoutOrders', '')::integer;
  v_takeout_rate numeric := 0;
  v_operating_hours numeric;
  v_turns numeric;
  v_customers_hour numeric;
  v_potential numeric;
  v_low_customers integer;
  v_base_customers integer;
  v_high_customers integer;
  v_confidence integer := 0;
  v_confidence_level public.confidence_level;
  v_can_estimate boolean := false;
  menu_item jsonb;
begin
  if v_owner is null then raise exception 'authentication required'; end if;

  if p_visit_id is not null then
    select cafe_id into v_old_cafe_id from public.cafe_visits where id = p_visit_id and owner_id = v_owner;
    if v_old_cafe_id is null then raise exception 'visit not found'; end if;
  end if;

  if v_mode = 'EXISTING' then
    v_cafe_id := nullif(p_payload->>'cafeId', '')::uuid;
    if not exists (select 1 from public.cafes where id = v_cafe_id and owner_id = v_owner) then
      raise exception 'cafe not found';
    end if;
  elsif v_mode = 'NEW' then
    insert into public.cafes (owner_id, name, region)
    values (v_owner, trim(p_payload->>'cafeName'), trim(p_payload->>'region'))
    returning id into v_cafe_id;
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

  if v_current is not null and v_seat is not null then
    v_occupancy := least(100, round(v_current::numeric / v_seat * 100));
  else
    v_occupancy := v_manual_occupancy;
  end if;

  if v_open is not null and v_close is not null then
    v_operating_hours := public.calculate_operating_hours(v_open, v_close);
    if v_operating_hours > 18 then v_operating_hours := null; end if;
  end if;

  if v_takeout_orders is not null then
    v_takeout_rate := case
      when v_takeout_orders <= 1 then 0
      when v_takeout_orders <= 3 then 0.05
      when v_takeout_orders <= 6 then 0.10
      when v_takeout_orders <= 9 then 0.18
      else 0.25 end;
  elsif v_takeout is not null then
    v_takeout_rate := case v_takeout when 'NONE' then 0 when 'LOW' then 0.05 when 'MEDIUM' then 0.12 else 0.20 end;
  end if;

  if v_seat is not null then v_confidence := v_confidence + 20; end if;
  if v_current is not null or v_manual_occupancy is not null then v_confidence := v_confidence + 20; end if;
  if v_spend is not null then v_confidence := v_confidence + 20; end if;
  if v_stay is not null then v_confidence := v_confidence + 15; end if;
  if v_open is not null and v_close is not null then v_confidence := v_confidence + 10; end if;
  if v_takeout is not null or v_takeout_orders is not null then v_confidence := v_confidence + 5; end if;
  if nullif(p_payload->>'observationDurationMinutes', '')::integer >= 10 then v_confidence := v_confidence + 5; end if;
  if nullif(p_payload->>'observationDurationMinutes', '')::integer >= 30 then v_confidence := v_confidence + 5; end if;
  v_confidence_level := case when v_confidence < 40 then 'LOW' when v_confidence < 70 then 'MEDIUM' else 'HIGH' end;

  v_can_estimate := v_seat is not null and v_occupancy is not null and v_stay is not null
    and v_spend is not null and v_operating_hours is not null and v_days is not null;
  if v_stay is not null then v_turns := 60::numeric / v_stay; end if;
  if v_can_estimate then
    v_customers_hour := v_seat * (v_occupancy::numeric / 100) * v_turns;
    v_potential := v_customers_hour * v_operating_hours;
    v_low_customers := round(v_potential * 0.417 * (1 + v_takeout_rate));
    v_base_customers := round(v_potential * 0.583 * (1 + v_takeout_rate));
    v_high_customers := round(v_potential * 0.764 * (1 + v_takeout_rate));
  end if;

  insert into public.cafe_business_snapshots (
    owner_id, cafe_visit_id, price_level, table_count, seat_count, current_customers,
    occupancy_rate, occupancy_input_mode, average_stay_minutes, estimated_average_spend,
    takeout_level, observed_takeout_orders, takeout_adjustment_rate, open_time, close_time,
    operating_hours, operating_days_per_month, estimated_seat_turns_per_hour,
    estimated_customers_per_hour, estimated_daily_customers_low, estimated_daily_customers_base,
    estimated_daily_customers_high, estimated_daily_sales_low, estimated_daily_sales_base,
    estimated_daily_sales_high, estimated_monthly_sales_low, estimated_monthly_sales_base,
    estimated_monthly_sales_high, confidence_score, confidence_level, estimation_model_version
  ) values (
    v_owner, v_visit_id, nullif(p_payload->>'priceLevel', '')::public.price_level,
    nullif(p_payload->>'tableCount', '')::integer, v_seat, v_current, v_occupancy,
    case when v_current is not null then 'CUSTOMERS'::public.occupancy_input_mode
      when v_manual_occupancy is not null then 'RATE'::public.occupancy_input_mode else null end,
    v_stay, v_spend, v_takeout, v_takeout_orders, v_takeout_rate, v_open, v_close,
    v_operating_hours, v_days, v_turns, v_customers_hour,
    v_low_customers, v_base_customers, v_high_customers,
    case when v_low_customers is null then null else v_low_customers::bigint * v_spend end,
    case when v_base_customers is null then null else v_base_customers::bigint * v_spend end,
    case when v_high_customers is null then null else v_high_customers::bigint * v_spend end,
    case when v_low_customers is null then null else v_low_customers::bigint * v_spend * v_days end,
    case when v_base_customers is null then null else v_base_customers::bigint * v_spend * v_days end,
    case when v_high_customers is null then null else v_high_customers::bigint * v_spend * v_days end,
    v_confidence, v_confidence_level, 'mvp-v1'
  )
  on conflict (cafe_visit_id) do update set
    price_level = excluded.price_level, table_count = excluded.table_count, seat_count = excluded.seat_count,
    current_customers = excluded.current_customers, occupancy_rate = excluded.occupancy_rate,
    occupancy_input_mode = excluded.occupancy_input_mode, average_stay_minutes = excluded.average_stay_minutes,
    estimated_average_spend = excluded.estimated_average_spend, takeout_level = excluded.takeout_level,
    observed_takeout_orders = excluded.observed_takeout_orders, takeout_adjustment_rate = excluded.takeout_adjustment_rate,
    open_time = excluded.open_time, close_time = excluded.close_time, operating_hours = excluded.operating_hours,
    operating_days_per_month = excluded.operating_days_per_month,
    estimated_seat_turns_per_hour = excluded.estimated_seat_turns_per_hour,
    estimated_customers_per_hour = excluded.estimated_customers_per_hour,
    estimated_daily_customers_low = excluded.estimated_daily_customers_low,
    estimated_daily_customers_base = excluded.estimated_daily_customers_base,
    estimated_daily_customers_high = excluded.estimated_daily_customers_high,
    estimated_daily_sales_low = excluded.estimated_daily_sales_low,
    estimated_daily_sales_base = excluded.estimated_daily_sales_base,
    estimated_daily_sales_high = excluded.estimated_daily_sales_high,
    estimated_monthly_sales_low = excluded.estimated_monthly_sales_low,
    estimated_monthly_sales_base = excluded.estimated_monthly_sales_base,
    estimated_monthly_sales_high = excluded.estimated_monthly_sales_high,
    confidence_score = excluded.confidence_score, confidence_level = excluded.confidence_level,
    estimation_model_version = excluded.estimation_model_version;

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
  select cafe_id into v_cafe_id from public.cafe_visits where id = p_visit_id and owner_id = v_owner;
  if v_cafe_id is null then raise exception 'visit not found'; end if;
  return query select p.bucket, p.object_path from public.cafe_photos p
    where p.cafe_visit_id = p_visit_id and p.owner_id = v_owner;
  delete from public.cafe_visits where id = p_visit_id and owner_id = v_owner;
  if not exists (select 1 from public.cafe_visits where cafe_id = v_cafe_id and owner_id = v_owner) then
    delete from public.cafes where id = v_cafe_id and owner_id = v_owner;
  end if;
end;
$$;

revoke execute on function public.save_cafe_visit(jsonb, uuid) from public, anon;
revoke execute on function public.delete_cafe_visit(uuid) from public, anon;
grant execute on function public.save_cafe_visit(jsonb, uuid) to authenticated;
grant execute on function public.delete_cafe_visit(uuid) to authenticated;
