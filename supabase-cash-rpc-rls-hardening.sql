begin;

create or replace function public.cash_user_can_access_barbershop(
  p_user_id uuid,
  p_barbershop_id uuid
)
returns boolean
language sql
security definer
set search_path = public
as $$
  select
    p_user_id is not null
    and p_barbershop_id is not null
    and (
      exists (
        select 1
        from public.user_roles role_row
        where role_row.user_id = p_user_id
          and role_row.role_name = 'super_admin'
      )
      or exists (
        select 1
        from public.profiles profile_row
        where profile_row.id = p_user_id
          and profile_row.barbershop_id = p_barbershop_id
      )
    );
$$;

create or replace function public.open_cash_session_atomic(
  p_barbershop_id uuid,
  p_branch_id uuid,
  p_opened_by uuid,
  p_opening_amount numeric,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auth_user uuid := auth.uid();
  v_session public.cash_sessions%rowtype;
  v_movement public.cash_movements%rowtype;
  v_opening_amount numeric(12,2) := greatest(coalesce(p_opening_amount, 0), 0);
begin
  if v_auth_user is null then
    raise exception 'Debes iniciar sesión para abrir caja.';
  end if;

  if not public.cash_user_can_access_barbershop(v_auth_user, p_barbershop_id) then
    raise exception 'No tienes permiso para abrir caja en esta barbería.';
  end if;

  if not exists (
    select 1
    from public.branches branch
    where branch.id = p_branch_id
      and branch.barbershop_id = p_barbershop_id
  ) then
    raise exception 'La sucursal no pertenece a la barbería seleccionada.';
  end if;

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
    coalesce(p_opened_by, v_auth_user),
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
    coalesce(p_opened_by, v_auth_user)
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
security definer
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

create or replace function public.close_cash_session_atomic(
  p_cash_session_id uuid,
  p_barbershop_id uuid,
  p_branch_id uuid,
  p_closed_by uuid,
  p_counted_cash_amount numeric,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auth_user uuid := auth.uid();
  v_session public.cash_sessions%rowtype;
  v_expected_cash numeric(12,2);
  v_counted_cash numeric(12,2) := greatest(coalesce(p_counted_cash_amount, 0), 0);
begin
  if v_auth_user is null then
    raise exception 'Debes iniciar sesión para cerrar caja.';
  end if;

  if not public.cash_user_can_access_barbershop(v_auth_user, p_barbershop_id) then
    raise exception 'No tienes permiso para cerrar caja en esta barbería.';
  end if;

  select coalesce(sum(
    case
      when payment_method <> 'cash' then 0
      when type = 'out' then -amount
      else amount
    end
  ), 0)
  into v_expected_cash
  from public.cash_movements
  where cash_session_id = p_cash_session_id;

  update public.cash_sessions
  set
    closed_by = coalesce(p_closed_by, v_auth_user),
    closed_at = now(),
    closing_amount = v_counted_cash,
    counted_cash_amount = v_counted_cash,
    expected_cash_amount = v_expected_cash,
    difference_amount = v_counted_cash - v_expected_cash,
    status = 'closed',
    notes = p_notes
  where id = p_cash_session_id
    and barbershop_id = p_barbershop_id
    and branch_id = p_branch_id
    and status = 'open'
    and closed_at is null
  returning * into v_session;

  if not found then
    raise exception 'No hay una caja abierta para cerrar.';
  end if;

  return to_jsonb(v_session);
end;
$$;

create or replace function public.register_pos_sale_atomic(
  p_sale_id uuid,
  p_barbershop_id uuid,
  p_branch_id uuid,
  p_cash_session_id uuid,
  p_payment_method text,
  p_raw_subtotal numeric,
  p_discount_total numeric,
  p_subtotal numeric,
  p_product_total numeric,
  p_service_total numeric,
  p_items jsonb,
  p_promotion_id text default null,
  p_promotion_name text default null,
  p_discount_label text default null,
  p_notes text default null,
  p_client_id uuid default null,
  p_client_name text default null,
  p_created_by uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auth_user uuid := auth.uid();
  v_session public.cash_sessions%rowtype;
  v_sale public.pos_sales%rowtype;
  v_movement public.cash_movements%rowtype;
  v_payment_method text := coalesce(nullif(p_payment_method, ''), 'cash');
begin
  if v_auth_user is null then
    raise exception 'Debes iniciar sesión para registrar ventas.';
  end if;

  if not public.cash_user_can_access_barbershop(v_auth_user, p_barbershop_id) then
    raise exception 'No tienes permiso para registrar ventas en esta barbería.';
  end if;

  select *
  into v_session
  from public.cash_sessions
  where id = p_cash_session_id
    and barbershop_id = p_barbershop_id
    and branch_id = p_branch_id
    and status = 'open'
    and closed_at is null
  for update;

  if not found then
    raise exception 'La caja seleccionada no está abierta o no pertenece a esta sucursal.';
  end if;

  insert into public.pos_sales (
    id,
    barbershop_id,
    branch_id,
    cash_session_id,
    payment_method,
    raw_subtotal,
    discount_total,
    subtotal,
    product_total,
    service_total,
    items,
    promotion_id,
    promotion_name,
    discount_label,
    notes,
    client_id,
    client_name,
    created_by
  )
  values (
    coalesce(p_sale_id, gen_random_uuid()),
    p_barbershop_id,
    p_branch_id,
    v_session.id,
    v_payment_method,
    coalesce(p_raw_subtotal, p_subtotal, 0),
    coalesce(p_discount_total, 0),
    coalesce(p_subtotal, 0),
    coalesce(p_product_total, 0),
    coalesce(p_service_total, 0),
    coalesce(p_items, '[]'::jsonb),
    p_promotion_id,
    p_promotion_name,
    p_discount_label,
    p_notes,
    p_client_id,
    p_client_name,
    coalesce(p_created_by, v_auth_user)
  )
  returning * into v_sale;

  if v_payment_method = 'cash' then
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
      'sale',
      'cash',
      coalesce(v_sale.subtotal, 0),
      'Venta POS #' || coalesce(v_sale.ticket_number::text, '0'),
      'pos_sale',
      v_sale.id,
      coalesce(p_created_by, v_auth_user)
    )
    returning * into v_movement;
  end if;

  return jsonb_build_object(
    'sale', to_jsonb(v_sale),
    'movement', case when v_movement.id is null then null else to_jsonb(v_movement) end
  );
end;
$$;

alter table public.cash_sessions enable row level security;
alter table public.cash_movements enable row level security;
alter table public.pos_sales enable row level security;

drop policy if exists cash_sessions_scoped_all on public.cash_sessions;
create policy cash_sessions_scoped_all
on public.cash_sessions
for all
to authenticated
using (public.cash_user_can_access_barbershop(auth.uid(), barbershop_id))
with check (public.cash_user_can_access_barbershop(auth.uid(), barbershop_id));

drop policy if exists cash_movements_scoped_all on public.cash_movements;
create policy cash_movements_scoped_all
on public.cash_movements
for all
to authenticated
using (public.cash_user_can_access_barbershop(auth.uid(), barbershop_id))
with check (public.cash_user_can_access_barbershop(auth.uid(), barbershop_id));

drop policy if exists pos_sales_scoped_all on public.pos_sales;
create policy pos_sales_scoped_all
on public.pos_sales
for all
to authenticated
using (public.cash_user_can_access_barbershop(auth.uid(), barbershop_id))
with check (public.cash_user_can_access_barbershop(auth.uid(), barbershop_id));

grant execute on function public.cash_user_can_access_barbershop(uuid, uuid) to authenticated;
grant execute on function public.open_cash_session_atomic(uuid, uuid, uuid, numeric, text) to authenticated;
grant execute on function public.open_cash_session_atomic(uuid, uuid, numeric, text) to authenticated;
grant execute on function public.close_cash_session_atomic(uuid, uuid, uuid, uuid, numeric, text) to authenticated;
grant execute on function public.register_pos_sale_atomic(uuid, uuid, uuid, uuid, text, numeric, numeric, numeric, numeric, numeric, jsonb, text, text, text, text, uuid, text, uuid) to authenticated;

notify pgrst, 'reload schema';

commit;
