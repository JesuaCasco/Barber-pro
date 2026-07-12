begin;

create or replace function public.open_cash_session_atomic(
  p_barbershop_id uuid,
  p_branch_id uuid,
  p_opened_by uuid,
  p_opening_amount numeric,
  p_notes text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_session public.cash_sessions%rowtype;
  v_movement public.cash_movements%rowtype;
  v_opening_amount numeric(12,2) := greatest(coalesce(p_opening_amount, 0), 0);
begin
  insert into public.cash_sessions (
    barbershop_id,
    branch_id,
    opened_by,
    opening_amount,
    expected_cash_amount,
    status,
    notes
  )
  values (
    p_barbershop_id,
    p_branch_id,
    p_opened_by,
    v_opening_amount,
    v_opening_amount,
    'open',
    p_notes
  )
  returning * into v_session;

  insert into public.cash_movements (
    cash_session_id,
    barbershop_id,
    branch_id,
    type,
    movement_kind,
    payment_method,
    amount,
    notes,
    reference_type,
    reference_id,
    created_by
  )
  values (
    v_session.id,
    p_barbershop_id,
    p_branch_id,
    'in',
    'opening',
    'cash',
    v_opening_amount,
    coalesce(p_notes, 'Apertura de caja'),
    'cash_session',
    v_session.id,
    p_opened_by
  )
  returning * into v_movement;

  return jsonb_build_object('session', to_jsonb(v_session), 'movement', to_jsonb(v_movement));
exception
  when unique_violation then
    raise exception 'Ya hay una caja abierta para esta sucursal.';
end;
$$;

create or replace function public.open_cash_session_atomic(
  p_branch_id uuid,
  p_opened_by uuid,
  p_opening_amount numeric,
  p_notes text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_barbershop_id uuid;
begin
  select branch.barbershop_id
    into v_barbershop_id
  from public.branches branch
  where branch.id = p_branch_id
  limit 1;

  if v_barbershop_id is null then
    raise exception 'No se pudo resolver la barbería para abrir caja desde la sucursal.';
  end if;

  return public.open_cash_session_atomic(
    v_barbershop_id,
    p_branch_id,
    p_opened_by,
    p_opening_amount,
    p_notes
  );
end;
$$;

grant execute on function public.open_cash_session_atomic(uuid, uuid, uuid, numeric, text) to authenticated;
grant execute on function public.open_cash_session_atomic(uuid, uuid, numeric, text) to authenticated;

notify pgrst, 'reload schema';

commit;
