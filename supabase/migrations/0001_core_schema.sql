begin;

create extension if not exists "pgcrypto";

create table if not exists activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  name text not null,
  activity_type text not null,
  started_at timestamptz not null,
  distance_m integer not null check (distance_m > 0),
  moving_time_s integer not null check (moving_time_s > 0),
  elevation_gain_m integer,
  calories integer,
  avg_pace_s numeric(10,2) generated always as (
    case
      when distance_m > 0 then moving_time_s::numeric / (distance_m::numeric / 1000)
      else null::numeric
    end
  ) stored,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists activities_user_started_idx on activities (user_id, started_at desc);
create index if not exists activities_started_idx on activities (started_at desc);

create table if not exists metrics_daily (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  metric_date date not null,
  distance_m integer not null default 0 check (distance_m >= 0),
  duration_s integer not null default 0 check (duration_s >= 0),
  elevation_gain_m integer not null default 0 check (elevation_gain_m >= 0),
  resting_hr integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint metrics_daily_user_date_unique unique (user_id, metric_date)
);

create index if not exists metrics_daily_user_date_idx on metrics_daily (user_id, metric_date desc);

create table if not exists plan_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  scheduled_for date not null,
  title text not null,
  activity_type text not null,
  target_distance_m integer check (target_distance_m > 0),
  target_time_s integer check (target_time_s > 0),
  notes text,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists plan_items_user_schedule_idx on plan_items (user_id, scheduled_for);
create index if not exists plan_items_status_idx on plan_items (status);

create table if not exists gear (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  name text not null,
  category text not null,
  brand text,
  model text,
  acquired_on date,
  retired_on date,
  total_distance_m integer not null default 0 check (total_distance_m >= 0),
  created_at timestamptz not null default now()
);

create index if not exists gear_user_category_idx on gear (user_id, category);
create index if not exists gear_user_retired_idx on gear (user_id, retired_on);

commit;
