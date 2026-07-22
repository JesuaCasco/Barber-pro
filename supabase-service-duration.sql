alter table public.services
  add column if not exists duration_minutes integer not null default 30;

alter table public.services
  drop constraint if exists services_duration_minutes_check;

alter table public.services
  add constraint services_duration_minutes_check
  check (duration_minutes between 5 and 720);
