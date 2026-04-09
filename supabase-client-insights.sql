alter table public.clients
add column if not exists completed_visits integer not null default 0,
add column if not exists total_spent numeric(12, 2) not null default 0,
add column if not exists last_visit_at date,
add column if not exists favorite_barber_id uuid references public.barbers(id) on delete set null,
add column if not exists favorite_barber_name text,
add column if not exists favorite_service_name text,
add column if not exists stats_updated_at timestamptz;

create index if not exists idx_appointments_client_status_date
on public.appointments (client_id, status, appointment_date desc, appointment_time desc);

create or replace function public.refresh_client_insights(target_client_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if target_client_id is null then
    return;
  end if;

  with completed_appointments as (
    select
      a.client_id,
      a.barber_id,
      coalesce(nullif(trim(a.barber_name), ''), nullif(trim(b.name), ''), nullif(trim(b.full_name), '')) as barber_display_name,
      nullif(trim(a.service_name), '') as service_name,
      coalesce(a.price, 0)::numeric(12, 2) as price,
      a.appointment_date,
      a.appointment_time
    from public.appointments a
    left join public.barbers b on b.id = a.barber_id
    where a.client_id = target_client_id
      and a.status = 'finalizada'
  ),
  summary as (
    select
      count(*)::integer as completed_visits,
      coalesce(sum(price), 0)::numeric(12, 2) as total_spent,
      max(appointment_date) as last_visit_at
    from completed_appointments
  ),
  favorite_barber as (
    select
      barber_id,
      barber_display_name
    from completed_appointments
    where barber_id is not null or barber_display_name is not null
    group by barber_id, barber_display_name
    order by count(*) desc, max(appointment_date) desc, max(appointment_time) desc
    limit 1
  ),
  favorite_service as (
    select
      service_name
    from completed_appointments
    where service_name is not null
    group by service_name
    order by count(*) desc, max(appointment_date) desc, max(appointment_time) desc
    limit 1
  )
  update public.clients c
  set
    completed_visits = coalesce((select summary.completed_visits from summary), 0),
    total_spent = coalesce((select summary.total_spent from summary), 0),
    last_visit_at = (select summary.last_visit_at from summary),
    favorite_barber_id = (select favorite_barber.barber_id from favorite_barber),
    favorite_barber_name = (select favorite_barber.barber_display_name from favorite_barber),
    favorite_service_name = (select favorite_service.service_name from favorite_service),
    stats_updated_at = now()
  where c.id = target_client_id;
end;
$$;

create or replace function public.refresh_client_insights_from_appointments()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    perform public.refresh_client_insights(old.client_id);
    return old;
  end if;

  if tg_op = 'UPDATE' and old.client_id is distinct from new.client_id and old.client_id is not null then
    perform public.refresh_client_insights(old.client_id);
  end if;

  if new.client_id is not null then
    perform public.refresh_client_insights(new.client_id);
  end if;

  return new;
end;
$$;

drop trigger if exists trg_refresh_client_insights_on_appointments on public.appointments;
create trigger trg_refresh_client_insights_on_appointments
after insert or update or delete on public.appointments
for each row
execute function public.refresh_client_insights_from_appointments();

select public.refresh_client_insights(id)
from public.clients;
