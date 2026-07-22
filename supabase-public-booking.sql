-- Plataforma publica de reservas para instalaciones independientes de BarberPro.
-- Ejecutar una vez por base de datos de barberia.

alter table public.appointments
  add column if not exists source text not null default 'internal',
  add column if not exists guest_name text,
  add column if not exists guest_phone text,
  add column if not exists claims_existing_client boolean not null default false,
  add column if not exists needs_client_confirmation boolean not null default false;

alter table public.appointments
  alter column client_id drop not null;

create index if not exists idx_appointments_public_lookup
  on public.appointments (appointment_date, appointment_time, barber_id)
  where status not in ('cancelada', 'cita_perdida');

create or replace function public.get_public_booking_snapshot(
  p_from date default current_date,
  p_to date default current_date + 45
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_barbershop_id uuid;
  v_branch_id uuid;
begin
  select id
    into v_barbershop_id
  from public.barbershops
  where coalesce(is_active, true) = true
  order by created_at asc nulls last
  limit 1;

  select id
    into v_branch_id
  from public.branches
  where barbershop_id = v_barbershop_id
    and coalesce(is_active, true) = true
  order by created_at asc nulls last
  limit 1;

  return jsonb_build_object(
    'barbershop', (
      select to_jsonb(shop)
      from (
        select id, name, slug, phone, city
        from public.barbershops
        where id = v_barbershop_id
      ) shop
    ),
    'branch', (
      select to_jsonb(branch)
      from (
        select id, name, city, address
        from public.branches
        where id = v_branch_id
      ) branch
    ),
    'services', coalesce((
      select jsonb_agg(to_jsonb(service) order by service.category, service.name)
      from (
        select id, name, category, price
        from public.services
        where coalesce(is_active, true) = true
          and (barbershop_id = v_barbershop_id or barbershop_id is null)
          and category <> 'Producto'
      ) service
    ), '[]'::jsonb),
    'barbers', coalesce((
      select jsonb_agg(to_jsonb(barber) order by barber.name)
      from (
        select id, name, avatar, color, bg, branch_id
        from public.barbers
        where coalesce(is_active, true) = true
          and (barbershop_id = v_barbershop_id or barbershop_id is null)
          and (v_branch_id is null or branch_id = v_branch_id or branch_id is null)
      ) barber
    ), '[]'::jsonb),
    'appointments', coalesce((
      select jsonb_agg(to_jsonb(appointment) order by appointment.appointment_date, appointment.appointment_time)
      from (
        select id, barber_id, appointment_date, appointment_time, duration_minutes, status
        from public.appointments
        where appointment_date between p_from and p_to
          and status not in ('cancelada', 'cita_perdida')
          and (barbershop_id = v_barbershop_id or barbershop_id is null)
          and (v_branch_id is null or branch_id = v_branch_id or branch_id is null)
      ) appointment
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.create_public_booking(
  p_service_id uuid,
  p_barber_id uuid,
  p_appointment_date date,
  p_appointment_time time,
  p_guest_name text,
  p_guest_phone text,
  p_claims_existing_client boolean default false,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_barbershop_id uuid;
  v_branch_id uuid;
  v_service record;
  v_barber record;
  v_id uuid := gen_random_uuid();
begin
  if p_appointment_date < current_date then
    raise exception 'No se puede reservar en una fecha pasada.';
  end if;

  if coalesce(trim(p_guest_name), '') = '' or coalesce(trim(p_guest_phone), '') = '' then
    raise exception 'Nombre y telefono son requeridos.';
  end if;

  select id
    into v_barbershop_id
  from public.barbershops
  where coalesce(is_active, true) = true
  order by created_at asc nulls last
  limit 1;

  select id
    into v_branch_id
  from public.branches
  where barbershop_id = v_barbershop_id
    and coalesce(is_active, true) = true
  order by created_at asc nulls last
  limit 1;

  select *
    into v_service
  from public.services
  where id = p_service_id
    and coalesce(is_active, true) = true
    and (barbershop_id = v_barbershop_id or barbershop_id is null)
  limit 1;

  if v_service.id is null then
    raise exception 'Servicio no disponible.';
  end if;

  select *
    into v_barber
  from public.barbers
  where id = p_barber_id
    and coalesce(is_active, true) = true
    and (barbershop_id = v_barbershop_id or barbershop_id is null)
  limit 1;

  if v_barber.id is null then
    raise exception 'Barbero no disponible.';
  end if;

  if exists (
    select 1
    from public.appointments
    where barber_id = p_barber_id
      and appointment_date = p_appointment_date
      and appointment_time = p_appointment_time
      and status not in ('cancelada', 'cita_perdida')
  ) then
    raise exception 'Ese horario ya no esta disponible.';
  end if;

  insert into public.appointments (
    id,
    barbershop_id,
    branch_id,
    client_id,
    client_name,
    guest_name,
    guest_phone,
    claims_existing_client,
    needs_client_confirmation,
    source,
    barber_id,
    barber_name,
    service_id,
    service_name,
    price,
    gross_amount,
    discount_amount,
    appointment_date,
    appointment_time,
    duration_minutes,
    type,
    status,
    notes
  ) values (
    v_id,
    v_barbershop_id,
    v_branch_id,
    null,
    trim(p_guest_name),
    trim(p_guest_name),
    trim(p_guest_phone),
    coalesce(p_claims_existing_client, false),
    true,
    'web',
    p_barber_id,
    v_barber.name,
    p_service_id,
    v_service.name,
    coalesce(v_service.price, 0),
    coalesce(v_service.price, 0),
    0,
    p_appointment_date,
    p_appointment_time,
    30,
    'reserva',
    'confirmada',
    p_notes
  );

  return jsonb_build_object('id', v_id, 'status', 'confirmada');
end;
$$;

grant execute on function public.get_public_booking_snapshot(date, date) to anon, authenticated;
grant execute on function public.create_public_booking(uuid, uuid, date, time, text, text, boolean, text) to anon, authenticated;


