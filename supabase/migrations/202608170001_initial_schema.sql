create extension if not exists pgcrypto with schema extensions;

create type public.menu_category as enum ('COFFEE', 'NON_COFFEE', 'DESSERT', 'BAKERY', 'BRUNCH', 'ETC');
create type public.price_level as enum ('CHEAP', 'NORMAL', 'HIGH', 'VERY_HIGH');
create type public.photo_kind as enum ('GENERAL', 'MENU_BOARD');
create type public.occupancy_input_mode as enum ('CUSTOMERS', 'RATE');
create type public.takeout_level as enum ('NONE', 'LOW', 'MEDIUM', 'HIGH');
create type public.confidence_level as enum ('LOW', 'MEDIUM', 'HIGH');

create function public.calculate_operating_hours(p_open text, p_close text)
returns numeric
language sql
immutable
strict
set search_path = ''
as $$
  select case
    when p_open = p_close then null
    else (
      case when
        (split_part(p_close, ':', 1)::integer * 60 + split_part(p_close, ':', 2)::integer)
          > (split_part(p_open, ':', 1)::integer * 60 + split_part(p_open, ':', 2)::integer)
      then
        (split_part(p_close, ':', 1)::integer * 60 + split_part(p_close, ':', 2)::integer)
          - (split_part(p_open, ':', 1)::integer * 60 + split_part(p_open, ':', 2)::integer)
      else
        1440 - (split_part(p_open, ':', 1)::integer * 60 + split_part(p_open, ':', 2)::integer)
          + (split_part(p_close, ':', 1)::integer * 60 + split_part(p_close, ':', 2)::integer)
      end
    )::numeric / 60
  end
$$;

create table public.cafes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  region text not null check (char_length(region) between 1 and 60),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, owner_id)
);

create table public.cafe_visits (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  cafe_id uuid not null,
  visited_at timestamptz not null,
  observation_duration_minutes integer check (observation_duration_minutes between 1 and 180),
  mood_tags text[] not null default '{}' check (cardinality(mood_tags) <= 5 and mood_tags <@ array['감성','대화','데이트','작업','조용함','오픈형','테이크아웃','디저트 강점']::text[]),
  customer_types text[] not null default '{}' check (cardinality(customer_types) <= 3 and customer_types <@ array['혼자','커플','친구','가족','직장인','학생','관광객']::text[]),
  visit_purposes text[] not null default '{}' check (cardinality(visit_purposes) <= 3 and visit_purposes <@ array['작업','대화','휴식','사진','디저트','테이크아웃']::text[]),
  space_rating smallint check (space_rating between 1 and 5),
  menu_rating smallint check (menu_rating between 1 and 5),
  location_rating smallint check (location_rating between 1 and 5),
  overall_rating smallint check (overall_rating between 1 and 5),
  strengths text check (char_length(strengths) <= 500),
  adoptable_points text check (char_length(adoptable_points) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, owner_id),
  constraint cafe_visits_cafe_owner_fk foreign key (cafe_id, owner_id)
    references public.cafes(id, owner_id) on delete cascade
);

create table public.cafe_photos (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  cafe_visit_id uuid not null,
  kind public.photo_kind not null,
  bucket text not null default 'cafe-photos' check (bucket = 'cafe-photos'),
  object_path text not null unique,
  mime_type text not null check (mime_type in ('image/jpeg', 'image/png', 'image/webp')),
  size_bytes integer not null check (size_bytes between 1 and 3145728),
  width integer check (width between 1 and 1600),
  height integer check (height between 1 and 1600),
  sort_order integer not null check (sort_order between 0 and 9),
  created_at timestamptz not null default now(),
  constraint cafe_photos_visit_owner_fk foreign key (cafe_visit_id, owner_id)
    references public.cafe_visits(id, owner_id) on delete cascade
);

create table public.cafe_menus (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  cafe_visit_id uuid not null,
  name text not null check (char_length(name) between 1 and 40),
  category public.menu_category not null,
  price integer not null check (price between 0 and 100000),
  is_signature boolean not null default false,
  sort_order integer not null check (sort_order between 0 and 9),
  created_at timestamptz not null default now(),
  constraint cafe_menus_visit_owner_fk foreign key (cafe_visit_id, owner_id)
    references public.cafe_visits(id, owner_id) on delete cascade,
  unique (cafe_visit_id, sort_order)
);

create table public.cafe_business_snapshots (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  cafe_visit_id uuid not null unique,
  price_level public.price_level,
  table_count integer check (table_count between 0 and 100),
  seat_count integer check (seat_count between 1 and 300),
  current_customers integer check (current_customers between 0 and 500),
  occupancy_rate integer check (occupancy_rate between 0 and 100),
  occupancy_input_mode public.occupancy_input_mode,
  average_stay_minutes integer check (average_stay_minutes in (30, 60, 90, 120, 150)),
  estimated_average_spend integer check (estimated_average_spend between 1000 and 100000),
  takeout_level public.takeout_level,
  observed_takeout_orders integer check (observed_takeout_orders between 0 and 50),
  takeout_adjustment_rate numeric(5,4) check (takeout_adjustment_rate between 0 and 0.25),
  open_time text check (open_time is null or open_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  close_time text check (close_time is null or close_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  operating_hours numeric(6,3) check (operating_hours > 0 and operating_hours <= 18),
  operating_days_per_month integer not null default 30 check (operating_days_per_month between 1 and 31),
  estimated_seat_turns_per_hour numeric(12,6),
  estimated_customers_per_hour numeric(12,6),
  estimated_daily_customers_low integer,
  estimated_daily_customers_base integer,
  estimated_daily_customers_high integer,
  estimated_daily_sales_low bigint,
  estimated_daily_sales_base bigint,
  estimated_daily_sales_high bigint,
  estimated_monthly_sales_low bigint,
  estimated_monthly_sales_base bigint,
  estimated_monthly_sales_high bigint,
  confidence_score smallint check (confidence_score between 0 and 100),
  confidence_level public.confidence_level,
  estimation_model_version text not null default 'mvp-v1',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cafe_business_snapshots_visit_owner_fk foreign key (cafe_visit_id, owner_id)
    references public.cafe_visits(id, owner_id) on delete cascade,
  constraint operating_hours_consistency_check check (
    (open_time is null and close_time is null and operating_hours is null)
    or coalesce((
      open_time is not null
      and close_time is not null
      and public.calculate_operating_hours(open_time, close_time) > 0
      and public.calculate_operating_hours(open_time, close_time) <= 18
      and operating_hours = public.calculate_operating_hours(open_time, close_time)
    ), false)
  ),
  constraint occupancy_mode_value_check check (
    (current_customers is null and occupancy_rate is null and occupancy_input_mode is null)
    or (current_customers is not null and occupancy_input_mode = 'CUSTOMERS'
      and (seat_count is null or occupancy_rate = least(100, round(current_customers::numeric / seat_count * 100))))
    or (current_customers is null and occupancy_rate is not null and occupancy_input_mode = 'RATE')
  )
);

create table public.visit_occupancy_observations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  cafe_visit_id uuid not null,
  observed_at timestamptz not null,
  current_customers integer check (current_customers between 0 and 500),
  occupancy_rate integer check (occupancy_rate between 0 and 100),
  created_at timestamptz not null default now(),
  constraint visit_observations_value_check check (current_customers is not null or occupancy_rate is not null),
  constraint visit_observations_visit_owner_fk foreign key (cafe_visit_id, owner_id)
    references public.cafe_visits(id, owner_id) on delete cascade
);

create index cafe_visits_owner_visited_idx on public.cafe_visits(owner_id, visited_at desc);
create index cafe_visits_cafe_idx on public.cafe_visits(cafe_id, visited_at desc);
create index cafe_photos_visit_sort_idx on public.cafe_photos(cafe_visit_id, kind, sort_order);
create index cafe_menus_visit_sort_idx on public.cafe_menus(cafe_visit_id, sort_order);
create index visit_observations_visit_time_idx on public.visit_occupancy_observations(cafe_visit_id, observed_at);

create function public.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create function public.prevent_owner_change()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.owner_id <> old.owner_id then
    raise exception 'owner_id is immutable';
  end if;
  return new;
end;
$$;

create function public.recompute_business_snapshot()
returns trigger language plpgsql set search_path = '' as $$
declare
  v_observation_minutes integer;
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

  new.operating_hours := case when new.open_time is not null and new.close_time is not null
    then public.calculate_operating_hours(new.open_time, new.close_time) else null end;
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

  new.estimated_seat_turns_per_hour := case when new.average_stay_minutes is null
    then null else 60::numeric / new.average_stay_minutes end;
  if new.seat_count is not null and new.occupancy_rate is not null
    and new.average_stay_minutes is not null and new.estimated_average_spend is not null
    and new.operating_hours is not null and new.operating_hours <= 18
    and new.operating_days_per_month is not null then
    new.estimated_customers_per_hour := new.seat_count * (new.occupancy_rate::numeric / 100)
      * new.estimated_seat_turns_per_hour;
    v_potential := new.estimated_customers_per_hour * new.operating_hours;
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

create trigger cafes_updated_at before update on public.cafes for each row execute function public.set_updated_at();
create trigger visits_updated_at before update on public.cafe_visits for each row execute function public.set_updated_at();
create trigger snapshots_updated_at before update on public.cafe_business_snapshots for each row execute function public.set_updated_at();
create trigger snapshots_recompute before insert or update on public.cafe_business_snapshots for each row execute function public.recompute_business_snapshot();

create trigger cafes_owner_immutable before update on public.cafes for each row execute function public.prevent_owner_change();
create trigger visits_owner_immutable before update on public.cafe_visits for each row execute function public.prevent_owner_change();
create trigger photos_owner_immutable before update on public.cafe_photos for each row execute function public.prevent_owner_change();
create trigger menus_owner_immutable before update on public.cafe_menus for each row execute function public.prevent_owner_change();
create trigger snapshots_owner_immutable before update on public.cafe_business_snapshots for each row execute function public.prevent_owner_change();
create trigger observations_owner_immutable before update on public.visit_occupancy_observations for each row execute function public.prevent_owner_change();

alter table public.cafes enable row level security;
alter table public.cafe_visits enable row level security;
alter table public.cafe_photos enable row level security;
alter table public.cafe_menus enable row level security;
alter table public.cafe_business_snapshots enable row level security;
alter table public.visit_occupancy_observations enable row level security;

-- Supabase projects created with the current secure default do not auto-expose new tables.
-- Grant the authenticated API role access explicitly; RLS remains the authorization boundary.
grant usage on schema public to authenticated;
grant select, insert, update, delete on table
  public.cafes,
  public.cafe_visits,
  public.cafe_photos,
  public.cafe_menus,
  public.cafe_business_snapshots,
  public.visit_occupancy_observations
to authenticated;

do $$
declare table_name text;
begin
  foreach table_name in array array['cafes', 'cafe_visits', 'cafe_photos', 'cafe_menus', 'cafe_business_snapshots', 'visit_occupancy_observations']
  loop
    execute format('create policy owner_select on public.%I for select to authenticated using (owner_id = auth.uid())', table_name);
    execute format('create policy owner_insert on public.%I for insert to authenticated with check (owner_id = auth.uid())', table_name);
    execute format('create policy owner_update on public.%I for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid())', table_name);
    execute format('create policy owner_delete on public.%I for delete to authenticated using (owner_id = auth.uid())', table_name);
  end loop;
end;
$$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('cafe-photos', 'cafe-photos', false, 3145728, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy cafe_photos_select on storage.objects for select to authenticated
using (bucket_id = 'cafe-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy cafe_photos_insert on storage.objects for insert to authenticated
with check (bucket_id = 'cafe-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy cafe_photos_update on storage.objects for update to authenticated
using (bucket_id = 'cafe-photos' and (storage.foldername(name))[1] = auth.uid()::text)
with check (bucket_id = 'cafe-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy cafe_photos_delete on storage.objects for delete to authenticated
using (bucket_id = 'cafe-photos' and (storage.foldername(name))[1] = auth.uid()::text);
