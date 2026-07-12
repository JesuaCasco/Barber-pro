begin;

create extension if not exists pgcrypto;

create table if not exists public.cash_sessions (
  id uuid primary key default gen_random_uuid(),
  barbershop_id uuid references public.barbershops(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  opened_by uuid references public.profiles(id) on delete set null,
  closed_by uuid references public.profiles(id) on delete set null,
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  opening_amount numeric(12,2) not null default 0,
  closing_amount numeric(12,2),
  status text not null default 'open',
  expected_cash_amount numeric(12,2) not null default 0,
  counted_cash_amount numeric(12,2),
  difference_amount numeric(12,2),
  notes text
);

create table if not exists public.cash_movements (
  id uuid primary key default gen_random_uuid(),
  cash_session_id uuid references public.cash_sessions(id) on delete cascade,
  barbershop_id uuid references public.barbershops(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  type text,
  amount numeric(12,2) not null default 0,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  movement_kind text not null default 'manual',
  payment_method text not null default 'cash',
  reference_type text,
  reference_id uuid
);

alter table if exists public.cash_sessions
  add column if not exists barbershop_id uuid references public.barbershops(id) on delete cascade,
  add column if not exists branch_id uuid references public.branches(id) on delete set null,
  add column if not exists opened_by uuid references public.profiles(id) on delete set null,
  add column if not exists closed_by uuid references public.profiles(id) on delete set null,
  add column if not exists opened_at timestamptz not null default now(),
  add column if not exists closed_at timestamptz,
  add column if not exists opening_amount numeric(12,2) not null default 0,
  add column if not exists closing_amount numeric(12,2),
  add column if not exists status text not null default 'open',
  add column if not exists expected_cash_amount numeric(12,2) not null default 0,
  add column if not exists counted_cash_amount numeric(12,2),
  add column if not exists difference_amount numeric(12,2),
  add column if not exists notes text;

alter table if exists public.cash_movements
  add column if not exists cash_session_id uuid references public.cash_sessions(id) on delete cascade,
  add column if not exists barbershop_id uuid references public.barbershops(id) on delete cascade,
  add column if not exists branch_id uuid references public.branches(id) on delete set null,
  add column if not exists type text,
  add column if not exists amount numeric(12,2) not null default 0,
  add column if not exists notes text,
  add column if not exists created_by uuid references public.profiles(id) on delete set null,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists movement_kind text not null default 'manual',
  add column if not exists payment_method text not null default 'cash',
  add column if not exists reference_type text,
  add column if not exists reference_id uuid;

alter table if exists public.cash_sessions drop constraint if exists cash_sessions_status_check;
alter table if exists public.cash_sessions
  add constraint cash_sessions_status_check check (status in ('open', 'closed'));

alter table if exists public.cash_movements drop constraint if exists cash_movements_type_check;
alter table if exists public.cash_movements
  add constraint cash_movements_type_check check (type in ('in', 'out'));

alter table if exists public.cash_movements drop constraint if exists cash_movements_payment_method_check;
alter table if exists public.cash_movements
  add constraint cash_movements_payment_method_check check (payment_method in ('cash', 'card', 'transfer', 'mixed', 'other'));

alter table if exists public.cash_movements drop constraint if exists cash_movements_kind_check;
alter table if exists public.cash_movements
  add constraint cash_movements_kind_check check (movement_kind in ('opening', 'sale', 'manual', 'closing_adjustment', 'payroll_payment'));

alter table if exists public.pos_sales
  add column if not exists cash_session_id uuid references public.cash_sessions(id) on delete set null,
  add column if not exists payment_method text not null default 'cash',
  add column if not exists client_id uuid references public.clients(id) on delete set null,
  add column if not exists client_name text;

alter table if exists public.pos_sales drop constraint if exists pos_sales_payment_method_check;
alter table if exists public.pos_sales
  add constraint pos_sales_payment_method_check check (payment_method in ('cash', 'card', 'transfer', 'mixed', 'other'));

create index if not exists idx_cash_sessions_branch_status on public.cash_sessions (branch_id, status, opened_at desc);
create index if not exists idx_cash_movements_session_created_at on public.cash_movements (cash_session_id, created_at desc);
create index if not exists idx_pos_sales_cash_session_id on public.pos_sales (cash_session_id);

create unique index if not exists idx_cash_sessions_one_open_per_branch
  on public.cash_sessions (barbershop_id, branch_id)
  where status = 'open' and closed_at is null;

alter table public.cash_sessions enable row level security;
alter table public.cash_movements enable row level security;
alter table public.pos_sales enable row level security;

grant select, insert, update, delete on public.cash_sessions to authenticated;
grant select, insert, update, delete on public.cash_movements to authenticated;
grant select, insert, update, delete on public.pos_sales to authenticated;
grant usage, select on all sequences in schema public to authenticated;

drop policy if exists cash_sessions_scoped_all on public.cash_sessions;
create policy cash_sessions_scoped_all
on public.cash_sessions
for all
to authenticated
using (public.can_access_barbershop(barbershop_id))
with check (public.can_access_barbershop(barbershop_id));

drop policy if exists cash_movements_scoped_all on public.cash_movements;
create policy cash_movements_scoped_all
on public.cash_movements
for all
to authenticated
using (public.can_access_barbershop(barbershop_id))
with check (public.can_access_barbershop(barbershop_id));

drop policy if exists pos_sales_update_scoped on public.pos_sales;
create policy pos_sales_update_scoped
on public.pos_sales
for update
to authenticated
using (public.can_manage_branch(barbershop_id))
with check (public.can_manage_branch(barbershop_id));

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
security invoker
set search_path = public
as $$
declare
  v_session public.cash_sessions%rowtype;
  v_sale public.pos_sales%rowtype;
  v_movement public.cash_movements%rowtype;
  v_payment_method text := coalesce(nullif(p_payment_method, ''), 'cash');
begin
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
    raise exception 'La caja seleccionada no esta abierta o no pertenece a esta sucursal.';
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
    p_created_by
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
      p_created_by
    )
    returning * into v_movement;
  end if;

  return jsonb_build_object(
    'sale', to_jsonb(v_sale),
    'movement', case when v_movement.id is null then null else to_jsonb(v_movement) end
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
security invoker
set search_path = public
as $$
declare
  v_session public.cash_sessions%rowtype;
  v_expected_cash numeric(12,2);
  v_counted_cash numeric(12,2) := greatest(coalesce(p_counted_cash_amount, 0), 0);
begin
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
    closed_by = p_closed_by,
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

create or replace function public.cancel_pos_sale_atomic(
  p_sale_id uuid,
  p_barbershop_id uuid,
  p_branch_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_sale public.pos_sales%rowtype;
begin
  select *
  into v_sale
  from public.pos_sales
  where id = p_sale_id
    and barbershop_id = p_barbershop_id
    and branch_id = p_branch_id;

  if not found then
    raise exception 'No se encontro la venta para cancelar.';
  end if;

  delete from public.cash_movements
  where reference_type = 'pos_sale'
    and reference_id = v_sale.id
    and cash_session_id = v_sale.cash_session_id;

  delete from public.pos_sales
  where id = v_sale.id;

  return to_jsonb(v_sale);
end;
$$;

create or replace function public.cancel_cash_movement_atomic(
  p_movement_id uuid,
  p_barbershop_id uuid,
  p_branch_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_movement public.cash_movements%rowtype;
begin
  select *
  into v_movement
  from public.cash_movements
  where id = p_movement_id
    and barbershop_id = p_barbershop_id
    and branch_id = p_branch_id
    and movement_kind = 'manual';

  if not found then
    raise exception 'No se encontro el movimiento manual para anular.';
  end if;

  delete from public.cash_movements
  where id = v_movement.id;

  return to_jsonb(v_movement);
end;
$$;

grant execute on function public.open_cash_session_atomic(uuid, uuid, uuid, numeric, text) to authenticated;
grant execute on function public.register_pos_sale_atomic(uuid, uuid, uuid, uuid, text, numeric, numeric, numeric, numeric, numeric, jsonb, text, text, text, text, uuid, text, uuid) to authenticated;
grant execute on function public.close_cash_session_atomic(uuid, uuid, uuid, uuid, numeric, text) to authenticated;
grant execute on function public.cancel_pos_sale_atomic(uuid, uuid, uuid) to authenticated;
grant execute on function public.cancel_cash_movement_atomic(uuid, uuid, uuid) to authenticated;

notify pgrst, 'reload schema';

commit;
