-- Refuse to hide pre-existing limit violations during the hardening migration.
do $$
begin
  if exists (
    select 1
    from public.cafe_photos
    group by cafe_visit_id, kind
    having count(*) > case when kind = 'GENERAL'::public.photo_kind then 10 else 3 end
  ) then
    raise exception 'cafe_photos exceeds the per-kind limit; reconcile the rows before migrating';
  end if;
end;
$$;

-- Normalize any legacy duplicate/gapped ordering before adding the invariant.
with ranked as (
  select
    id,
    row_number() over (
      partition by cafe_visit_id, kind
      order by sort_order, created_at, id
    ) - 1 as normalized_sort_order
  from public.cafe_photos
)
update public.cafe_photos as photo
set sort_order = ranked.normalized_sort_order
from ranked
where photo.id = ranked.id
  and photo.sort_order <> ranked.normalized_sort_order;

alter table public.cafe_photos
  add constraint cafe_photos_visit_kind_sort_unique
  unique (cafe_visit_id, kind, sort_order)
  deferrable initially deferred;

alter table public.cafe_photos
  add constraint cafe_photos_owner_visit_path_check check (
    split_part(object_path, '/', 1) = owner_id::text
    and split_part(object_path, '/', 2) = cafe_visit_id::text
    and split_part(object_path, '/', 3) <> ''
  ) not valid;

alter table public.cafe_photos validate constraint cafe_photos_owner_visit_path_check;

-- Minute-based durations such as 10:01-21:59 are recurring decimals. A fixed
-- scale made the value differ from calculate_operating_hours() and violated
-- the exact consistency constraint for otherwise valid inputs.
alter table public.cafe_business_snapshots drop constraint operating_hours_consistency_check;
alter table public.cafe_business_snapshots alter column operating_hours type numeric;
alter table public.cafe_business_snapshots
  add constraint operating_hours_consistency_check check (
    (open_time is null and close_time is null and operating_hours is null)
    or coalesce((
      open_time is not null
      and close_time is not null
      and public.calculate_operating_hours(open_time, close_time) > 0
      and public.calculate_operating_hours(open_time, close_time) <= 18
      and operating_hours = public.calculate_operating_hours(open_time, close_time)
    ), false)
  );

-- Keep full precision in local variables. Numeric column scales are persistence
-- formats and must not feed rounded intermediate values back into the model.
create or replace function public.recompute_business_snapshot()
returns trigger language plpgsql set search_path = '' as $$
declare
  v_observation_minutes integer;
  v_operating_hours numeric;
  v_turns numeric;
  v_customers_per_hour numeric;
  v_potential numeric;
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

  v_operating_hours := case when new.open_time is not null and new.close_time is not null
    then public.calculate_operating_hours(new.open_time, new.close_time) else null end;
  new.operating_hours := v_operating_hours;
  new.takeout_adjustment_rate := case
    when new.observed_takeout_orders is not null then case
      when new.observed_takeout_orders <= 1 then 0
      when new.observed_takeout_orders <= 3 then 0.05
      when new.observed_takeout_orders <= 6 then 0.10
      when new.observed_takeout_orders <= 9 then 0.18
      else 0.25 end
    when new.takeout_level = 'NONE' then 0
    when new.takeout_level = 'LOW' then 0.05
    when new.takeout_level = 'MEDIUM' then 0.12
    when new.takeout_level = 'HIGH' then 0.20
    else 0 end;

  v_turns := case when new.average_stay_minutes is null
    then null else 60::numeric / new.average_stay_minutes end;
  new.estimated_seat_turns_per_hour := v_turns;
  if new.seat_count is not null and new.occupancy_rate is not null
    and new.average_stay_minutes is not null and new.estimated_average_spend is not null
    and v_operating_hours is not null and v_operating_hours <= 18
    and new.operating_days_per_month is not null then
    v_customers_per_hour := new.seat_count * (new.occupancy_rate::numeric / 100) * v_turns;
    new.estimated_customers_per_hour := v_customers_per_hour;
    v_potential := v_customers_per_hour * v_operating_hours;
    new.estimated_daily_customers_low := round(v_potential * 0.417 * (1 + new.takeout_adjustment_rate));
    new.estimated_daily_customers_base := round(v_potential * 0.583 * (1 + new.takeout_adjustment_rate));
    new.estimated_daily_customers_high := round(v_potential * 0.764 * (1 + new.takeout_adjustment_rate));
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

-- The snapshot trigger is the single persisted-calculation implementation.
-- The save transaction now writes raw inputs only and lets that trigger derive every result.
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
  menu_item jsonb;
begin
  if v_owner is null then raise exception 'authentication required'; end if;

  if p_visit_id is not null then
    select cafe_id into v_old_cafe_id
    from public.cafe_visits
    where id = p_visit_id and owner_id = v_owner;
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

create or replace function public.finalize_cafe_photo(
  p_visit_id uuid,
  p_kind public.photo_kind,
  p_object_path text,
  p_mime_type text,
  p_size_bytes integer,
  p_width integer,
  p_height integer,
  p_sort_order integer
)
returns setof public.cafe_photos
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
  v_limit integer := case when p_kind = 'GENERAL'::public.photo_kind then 10 else 3 end;
  v_object storage.objects%rowtype;
  v_photo public.cafe_photos%rowtype;
begin
  if v_owner is null then raise exception 'authentication required'; end if;

  perform 1
  from public.cafe_visits
  where id = p_visit_id and owner_id = v_owner
  for update;
  if not found then raise exception 'visit not found'; end if;

  if p_object_path not like v_owner::text || '/' || p_visit_id::text || '/%' then
    raise exception 'invalid photo path';
  end if;
  if p_mime_type not in ('image/jpeg', 'image/png', 'image/webp')
    or p_size_bytes not between 1 and 3145728
    or p_width not between 1 and 1600
    or p_height not between 1 and 1600
    or p_sort_order not between 0 and v_limit - 1 then
    raise exception 'invalid photo metadata';
  end if;
  if not (
    (p_mime_type = 'image/jpeg' and p_object_path ~* '\.(jpg|jpeg)$')
    or (p_mime_type = 'image/png' and p_object_path ~* '\.png$')
    or (p_mime_type = 'image/webp' and p_object_path ~* '\.webp$')
  ) then
    raise exception 'photo extension does not match MIME type';
  end if;

  select * into v_object
  from storage.objects
  where bucket_id = 'cafe-photos' and name = p_object_path;
  if not found
    or v_object.metadata->>'mimetype' is distinct from p_mime_type
    or coalesce(nullif(v_object.metadata->>'size', '')::bigint, -1) <> p_size_bytes then
    raise exception 'storage object metadata mismatch';
  end if;

  if (select count(*) from public.cafe_photos where cafe_visit_id = p_visit_id and kind = p_kind) >= v_limit then
    raise exception 'photo limit exceeded';
  end if;

  insert into public.cafe_photos (
    owner_id, cafe_visit_id, kind, bucket, object_path, mime_type,
    size_bytes, width, height, sort_order
  ) values (
    v_owner, p_visit_id, p_kind, 'cafe-photos', p_object_path, p_mime_type,
    p_size_bytes, p_width, p_height, p_sort_order
  )
  returning * into v_photo;

  return next v_photo;
end;
$$;

create or replace function public.remove_cafe_photo(p_photo_id uuid, p_visit_id uuid)
returns table (bucket text, object_path text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
begin
  if v_owner is null then raise exception 'authentication required'; end if;

  perform 1
  from public.cafe_visits
  where id = p_visit_id and owner_id = v_owner
  for update;
  if not found then raise exception 'visit not found'; end if;

  return query
  delete from public.cafe_photos as photo
  where photo.id = p_photo_id
    and photo.cafe_visit_id = p_visit_id
    and photo.owner_id = v_owner
  returning photo.bucket, photo.object_path;

  if not found then raise exception 'photo not found'; end if;
end;
$$;

create or replace function public.reorder_cafe_photos(
  p_visit_id uuid,
  p_kind public.photo_kind,
  p_photo_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
  v_limit integer := case when p_kind = 'GENERAL'::public.photo_kind then 10 else 3 end;
  v_actual_count integer;
  v_matching_count integer;
begin
  if v_owner is null then raise exception 'authentication required'; end if;

  perform 1
  from public.cafe_visits
  where id = p_visit_id and owner_id = v_owner
  for update;
  if not found then raise exception 'visit not found'; end if;

  if p_photo_ids is null or cardinality(p_photo_ids) > v_limit
    or cardinality(p_photo_ids) <> (select count(distinct id) from unnest(p_photo_ids) as supplied(id)) then
    raise exception 'invalid photo order';
  end if;

  select count(*) into v_actual_count
  from public.cafe_photos
  where cafe_visit_id = p_visit_id and owner_id = v_owner and kind = p_kind;

  select count(*) into v_matching_count
  from public.cafe_photos
  where cafe_visit_id = p_visit_id and owner_id = v_owner and kind = p_kind
    and id = any(p_photo_ids);

  if v_actual_count <> cardinality(p_photo_ids) or v_matching_count <> cardinality(p_photo_ids) then
    raise exception 'photo order must include every photo of the kind';
  end if;

  update public.cafe_photos as photo
  set sort_order = supplied.ordinality - 1
  from unnest(p_photo_ids) with ordinality as supplied(id, ordinality)
  where photo.id = supplied.id
    and photo.cafe_visit_id = p_visit_id
    and photo.owner_id = v_owner
    and photo.kind = p_kind;
end;
$$;

revoke insert, update, delete on public.cafe_photos from authenticated;

revoke execute on function public.finalize_cafe_photo(uuid, public.photo_kind, text, text, integer, integer, integer, integer) from public, anon;
revoke execute on function public.remove_cafe_photo(uuid, uuid) from public, anon;
revoke execute on function public.reorder_cafe_photos(uuid, public.photo_kind, uuid[]) from public, anon;
grant execute on function public.finalize_cafe_photo(uuid, public.photo_kind, text, text, integer, integer, integer, integer) to authenticated;
grant execute on function public.remove_cafe_photo(uuid, uuid) to authenticated;
grant execute on function public.reorder_cafe_photos(uuid, public.photo_kind, uuid[]) to authenticated;
