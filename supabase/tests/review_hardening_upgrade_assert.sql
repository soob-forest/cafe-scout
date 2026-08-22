do $$
declare
  snapshot_record record;
  observation_rate integer;
begin
  select estimated_daily_customers_base, estimated_daily_sales_base,
    estimated_monthly_sales_base, confidence_score, confidence_level
  into snapshot_record
  from public.cafe_business_snapshots
  where cafe_visit_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb5';

  if snapshot_record.estimated_daily_customers_base is distinct from 91
    or snapshot_record.estimated_daily_sales_base is distinct from 728000
    or snapshot_record.estimated_monthly_sales_base is distinct from 21840000
    or snapshot_record.confidence_score is distinct from 100
    or snapshot_record.confidence_level is distinct from 'HIGH'::public.confidence_level then
    raise exception 'review hardening migration did not backfill the existing snapshot: %', snapshot_record;
  end if;

  select occupancy_rate into observation_rate
  from public.visit_occupancy_observations
  where id = 'cccccccc-cccc-4ccc-8ccc-ccccccccccc5';

  if observation_rate is distinct from 50 then
    raise exception 'review hardening migration did not backfill the existing observation: %', observation_rate;
  end if;
end
$$;
