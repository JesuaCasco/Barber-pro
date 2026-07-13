begin;

-- RPCs que el frontend ya usa para anulaciones. Se dejan en base de datos para
-- que BarberPro no dependa de fallback local ni de operaciones parciales.

create or replace function public.cancel_pos_sale_atomic(
  p_sale_id uuid,
  p_barbershop_id uuid,
  p_branch_id uuid,
  p_reason text default 'Sin motivo especificado'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auth_user uuid := auth.uid();
  v_sale public.pos_sales%rowtype;
  v_canceled_at timestamptz := now();
  v_reason text := coalesce(nullif(p_reason, ''), 'Sin motivo especificado');
begin
  if v_auth_user is null then
    raise exception 'Debes iniciar sesion para anular ventas.';
  end if;

  if not public.cash_user_can_access_barbershop(v_auth_user, p_barbershop_id) then
    raise exception 'No tienes permiso para anular ventas en esta barberia.';
  end if;

  select *
    into v_sale
  from public.pos_sales
  where id = p_sale_id
    and barbershop_id = p_barbershop_id
    and branch_id = p_branch_id
  for update;

  if not found then
    raise exception 'No se encontro la venta para anular.';
  end if;

  update public.pos_sales
  set notes = jsonb_build_object(
    'source', 'cancel_pos_sale',
    'previousNotes', coalesce(v_sale.notes, ''),
    'canceledAt', v_canceled_at,
    'canceledBy', v_auth_user,
    'cancellationReason', v_reason
  )::text
  where id = v_sale.id
  returning * into v_sale;

  return to_jsonb(v_sale);
end;
$$;

create or replace function public.cancel_cash_movement_atomic(
  p_movement_id uuid,
  p_barbershop_id uuid,
  p_branch_id uuid,
  p_reason text default 'Sin motivo especificado'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auth_user uuid := auth.uid();
  v_original public.cash_movements%rowtype;
  v_reversal public.cash_movements%rowtype;
  v_reason text := coalesce(nullif(p_reason, ''), 'Sin motivo especificado');
begin
  if v_auth_user is null then
    raise exception 'Debes iniciar sesion para anular movimientos.';
  end if;

  if not public.cash_user_can_access_barbershop(v_auth_user, p_barbershop_id) then
    raise exception 'No tienes permiso para anular movimientos en esta barberia.';
  end if;

  select *
    into v_original
  from public.cash_movements
  where id = p_movement_id
    and barbershop_id = p_barbershop_id
    and branch_id = p_branch_id
  for update;

  if not found then
    raise exception 'No se encontro el movimiento para anular.';
  end if;

  if coalesce(v_original.reference_type, '') like '%void%' then
    raise exception 'No se puede anular un reverso.';
  end if;

  if exists (
    select 1
    from public.cash_movements existing_reversal
    where existing_reversal.reference_type = 'cash_movement_void'
      and existing_reversal.reference_id = v_original.id
  ) then
    raise exception 'Este movimiento ya fue anulado.';
  end if;

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
    v_original.cash_session_id,
    p_barbershop_id,
    p_branch_id,
    case when v_original.type = 'out' then 'in' else 'out' end,
    'manual',
    case when v_original.type = 'out' then 'ingreso_manual' else 'retiro' end,
    coalesce(v_original.payment_method, 'cash'),
    coalesce(v_original.amount, 0),
    jsonb_build_object(
      'label', 'Anulacion movimiento: ' || coalesce(v_original.notes, v_original.description, 'Sin detalle') || ' - ' || v_reason,
      'reversalOf', v_original.id,
      'reason', v_reason
    )::text,
    'Anulacion movimiento: ' || coalesce(v_original.description, v_original.notes, 'Sin detalle'),
    'cash_movement_void',
    v_original.id,
    v_auth_user
  )
  returning * into v_reversal;

  return to_jsonb(v_reversal);
end;
$$;

grant execute on function public.cancel_pos_sale_atomic(uuid, uuid, uuid, text) to authenticated;
grant execute on function public.cancel_cash_movement_atomic(uuid, uuid, uuid, text) to authenticated;

notify pgrst, 'reload schema';

commit;
