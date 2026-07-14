alter table if exists public.cash_movements
  drop constraint if exists cash_movements_kind_check;

alter table if exists public.cash_movements
  add constraint cash_movements_kind_check
  check (movement_kind in ('opening', 'sale', 'manual', 'closing_adjustment', 'payroll_payment', 'cash_advance'));

create or replace function public.create_cash_advance_with_movement(
  p_advance_id uuid,
  p_barbershop_id uuid,
  p_branch_id uuid,
  p_barber_id uuid,
  p_barber_name text,
  p_amount numeric,
  p_note text default null,
  p_advance_date date default current_date,
  p_created_by uuid default null,
  p_cash_session_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auth_user uuid := auth.uid();
  v_session public.cash_sessions%rowtype;
  v_advance public.barber_cash_advances%rowtype;
  v_movement public.cash_movements%rowtype;
  v_amount numeric(12,2) := greatest(coalesce(p_amount, 0), 0);
begin
  if v_auth_user is null then
    raise exception 'Debes iniciar sesion para registrar un adelanto.';
  end if;

  if v_amount <= 0 then
    raise exception 'El monto del adelanto debe ser mayor a cero.';
  end if;

  if not public.cash_user_can_access_barbershop(v_auth_user, p_barbershop_id) then
    raise exception 'No tienes permiso para registrar adelantos en esta barberia.';
  end if;

  if not exists (
    select 1
    from public.branches branch
    where branch.id = p_branch_id
      and branch.barbershop_id = p_barbershop_id
  ) then
    raise exception 'La sucursal no pertenece a la barberia seleccionada.';
  end if;

  if not exists (
    select 1
    from public.barbers barber
    where barber.id = p_barber_id
      and barber.barbershop_id = p_barbershop_id
  ) then
    raise exception 'El barbero no pertenece a la barberia seleccionada.';
  end if;

  if p_cash_session_id is not null then
    select *
      into v_session
    from public.cash_sessions session
    where session.id = p_cash_session_id
      and session.barbershop_id = p_barbershop_id
      and session.branch_id = p_branch_id
      and session.status = 'open'
      and session.closed_at is null
    limit 1;
  else
    select *
      into v_session
    from public.cash_sessions session
    where session.barbershop_id = p_barbershop_id
      and session.branch_id = p_branch_id
      and session.status = 'open'
      and session.closed_at is null
    order by session.opened_at desc
    limit 1;
  end if;

  if v_session.id is null then
    raise exception 'Debes abrir caja antes de registrar un adelanto.';
  end if;

  insert into public.barber_cash_advances (
    id,
    barbershop_id,
    branch_id,
    barber_id,
    barber_name,
    amount,
    note,
    advance_date,
    created_by,
    created_at
  )
  values (
    p_advance_id,
    p_barbershop_id,
    p_branch_id,
    p_barber_id,
    coalesce(nullif(p_barber_name, ''), 'Barbero'),
    v_amount,
    p_note,
    coalesce(p_advance_date, current_date),
    coalesce(p_created_by, v_auth_user),
    timezone('utc', now())
  )
  returning * into v_advance;

  insert into public.cash_movements (
    cash_session_id,
    barbershop_id,
    branch_id,
    type,
    movement_kind,
    movement_type,
    payment_method,
    amount,
    notes,
    description,
    reference_type,
    reference_id,
    created_by
  )
  values (
    v_session.id,
    p_barbershop_id,
    p_branch_id,
    'out',
    'cash_advance',
    'retiro',
    'cash',
    v_amount,
    concat('Adelanto a barbero - ', coalesce(nullif(p_barber_name, ''), 'Barbero'), case when nullif(p_note, '') is not null then concat(' - ', p_note) else '' end),
    concat('Adelanto a barbero - ', coalesce(nullif(p_barber_name, ''), 'Barbero')),
    'cash_advance',
    v_advance.id,
    coalesce(p_created_by, v_auth_user)
  )
  returning * into v_movement;

  return jsonb_build_object(
    'advance', to_jsonb(v_advance),
    'movement', to_jsonb(v_movement)
  );
end;
$$;

grant execute on function public.create_cash_advance_with_movement(uuid, uuid, uuid, uuid, text, numeric, text, date, uuid, uuid) to authenticated;
