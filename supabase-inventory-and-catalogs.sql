create table if not exists public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  barbershop_id uuid references public.barbershops(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  service_id uuid references public.services(id) on delete set null,
  product_name text not null,
  product_category text not null default 'Otros',
  usage_type text not null default 'retail',
  sku text,
  barcode text,
  unit_name text not null default 'unidad',
  track_stock boolean not null default true,
  min_stock numeric not null default 0,
  max_stock numeric,
  cost_price numeric not null default 0,
  sale_price numeric not null default 0,
  current_stock numeric not null default 0,
  notes text,
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint inventory_items_usage_type_check check (usage_type in ('retail', 'internal', 'both')),
  constraint inventory_items_stock_nonnegative check (current_stock >= 0),
  constraint inventory_items_min_stock_nonnegative check (min_stock >= 0),
  constraint inventory_items_max_stock_check check (max_stock is null or max_stock >= min_stock),
  constraint inventory_items_cost_nonnegative check (cost_price >= 0),
  constraint inventory_items_sale_price_check check (sale_price >= 0)
);

create index if not exists idx_inventory_items_barbershop_branch on public.inventory_items (barbershop_id, branch_id);
create index if not exists idx_inventory_items_service_id on public.inventory_items (service_id);
create index if not exists idx_inventory_items_usage_type on public.inventory_items (usage_type);
create index if not exists idx_inventory_items_product_category on public.inventory_items (product_category);

create unique index if not exists idx_inventory_items_sku_branch_unique
on public.inventory_items (
  barbershop_id,
  coalesce(branch_id, '00000000-0000-0000-0000-000000000000'::uuid),
  lower(sku)
)
where sku is not null and sku <> '';

create table if not exists public.service_inventory_usage (
  id uuid primary key default gen_random_uuid(),
  barbershop_id uuid references public.barbershops(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  service_id uuid not null references public.services(id) on delete cascade,
  inventory_item_id uuid not null references public.inventory_items(id) on delete restrict,
  quantity numeric not null default 1,
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint service_inventory_usage_quantity_check check (quantity > 0),
  constraint service_inventory_usage_unique unique (service_id, inventory_item_id)
);

create index if not exists idx_service_inventory_usage_service on public.service_inventory_usage (service_id);
create index if not exists idx_service_inventory_usage_item on public.service_inventory_usage (inventory_item_id);

create table if not exists public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  inventory_item_id uuid not null references public.inventory_items(id) on delete restrict,
  barbershop_id uuid references public.barbershops(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  movement_type text not null,
  reason text not null default 'adjustment',
  quantity numeric not null,
  stock_before numeric not null default 0,
  stock_after numeric not null default 0,
  unit_cost numeric,
  unit_price numeric,
  reference_type text,
  reference_id uuid,
  cash_session_id uuid,
  pos_sale_id uuid references public.pos_sales(id) on delete set null,
  purchase_id uuid,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint inventory_movements_type_check check (movement_type in ('in', 'out', 'adjustment')),
  constraint inventory_movements_quantity_check check (quantity > 0)
);

create index if not exists idx_inventory_movements_item_date on public.inventory_movements (inventory_item_id, created_at desc);
create index if not exists idx_inventory_movements_barbershop_date on public.inventory_movements (barbershop_id, created_at desc);

create table if not exists public.barbershop_catalogs (
  id uuid primary key default gen_random_uuid(),
  barbershop_id uuid not null references public.barbershops(id) on delete cascade,
  catalog_key text not null,
  values jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint barbershop_catalogs_key_check check (catalog_key in ('service_categories', 'inventory_product_categories')),
  constraint barbershop_catalogs_values_array_check check (jsonb_typeof(values) = 'array'),
  constraint barbershop_catalogs_unique unique (barbershop_id, catalog_key)
);

create index if not exists idx_barbershop_catalogs_barbershop_key on public.barbershop_catalogs (barbershop_id, catalog_key);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_inventory_items_updated_at on public.inventory_items;
create trigger trg_inventory_items_updated_at
before update on public.inventory_items
for each row execute function public.set_updated_at();

drop trigger if exists trg_service_inventory_usage_updated_at on public.service_inventory_usage;
create trigger trg_service_inventory_usage_updated_at
before update on public.service_inventory_usage
for each row execute function public.set_updated_at();

drop trigger if exists trg_barbershop_catalogs_updated_at on public.barbershop_catalogs;
create trigger trg_barbershop_catalogs_updated_at
before update on public.barbershop_catalogs
for each row execute function public.set_updated_at();

create or replace function public.register_inventory_movement_atomic(
  p_inventory_item_id uuid,
  p_movement_type text,
  p_reason text,
  p_quantity numeric,
  p_unit_cost numeric default null,
  p_unit_price numeric default null,
  p_reference_type text default null,
  p_reference_id uuid default null,
  p_cash_session_id uuid default null,
  p_pos_sale_id uuid default null,
  p_purchase_id uuid default null,
  p_notes text default null,
  p_metadata jsonb default '{}'::jsonb,
  p_created_by uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item public.inventory_items%rowtype;
  v_stock_before numeric;
  v_stock_after numeric;
  v_movement public.inventory_movements%rowtype;
begin
  if p_quantity <= 0 then
    raise exception 'La cantidad debe ser mayor a cero.';
  end if;

  select * into v_item
  from public.inventory_items
  where id = p_inventory_item_id
  for update;

  if not found then
    raise exception 'Producto de inventario no encontrado.';
  end if;

  v_stock_before := coalesce(v_item.current_stock, 0);

  if p_movement_type = 'in' then
    v_stock_after := v_stock_before + p_quantity;
  elsif p_movement_type = 'out' then
    v_stock_after := v_stock_before - p_quantity;
  elsif p_movement_type = 'adjustment' then
    v_stock_after := p_quantity;
  else
    raise exception 'Tipo de movimiento de inventario inválido.';
  end if;

  if v_stock_after < 0 then
    raise exception 'Stock insuficiente para %.', v_item.product_name;
  end if;

  update public.inventory_items
  set current_stock = v_stock_after,
      updated_by = p_created_by,
      updated_at = now()
  where id = p_inventory_item_id
  returning * into v_item;

  insert into public.inventory_movements (
    inventory_item_id,
    barbershop_id,
    branch_id,
    movement_type,
    reason,
    quantity,
    stock_before,
    stock_after,
    unit_cost,
    unit_price,
    reference_type,
    reference_id,
    cash_session_id,
    pos_sale_id,
    purchase_id,
    notes,
    metadata,
    created_by
  ) values (
    p_inventory_item_id,
    v_item.barbershop_id,
    v_item.branch_id,
    p_movement_type,
    coalesce(p_reason, 'adjustment'),
    p_quantity,
    v_stock_before,
    v_stock_after,
    p_unit_cost,
    p_unit_price,
    p_reference_type,
    p_reference_id,
    p_cash_session_id,
    p_pos_sale_id,
    p_purchase_id,
    p_notes,
    coalesce(p_metadata, '{}'::jsonb),
    p_created_by
  )
  returning * into v_movement;

  return jsonb_build_object(
    'item', to_jsonb(v_item),
    'movement', to_jsonb(v_movement)
  );
end;
$$;

alter table public.inventory_items enable row level security;
alter table public.service_inventory_usage enable row level security;
alter table public.inventory_movements enable row level security;
alter table public.barbershop_catalogs enable row level security;

drop policy if exists inventory_items_scoped_all on public.inventory_items;
create policy inventory_items_scoped_all on public.inventory_items for all to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and (
        exists (select 1 from public.user_roles ur where ur.user_id = auth.uid() and ur.role_name = 'super_admin')
        or p.barbershop_id = inventory_items.barbershop_id
      )
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and (
        exists (select 1 from public.user_roles ur where ur.user_id = auth.uid() and ur.role_name = 'super_admin')
        or p.barbershop_id = inventory_items.barbershop_id
      )
  )
);

drop policy if exists service_inventory_usage_scoped_all on public.service_inventory_usage;
create policy service_inventory_usage_scoped_all on public.service_inventory_usage for all to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and (
        exists (select 1 from public.user_roles ur where ur.user_id = auth.uid() and ur.role_name = 'super_admin')
        or p.barbershop_id = service_inventory_usage.barbershop_id
      )
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and (
        exists (select 1 from public.user_roles ur where ur.user_id = auth.uid() and ur.role_name = 'super_admin')
        or p.barbershop_id = service_inventory_usage.barbershop_id
      )
  )
);

drop policy if exists inventory_movements_scoped_read on public.inventory_movements;
create policy inventory_movements_scoped_read on public.inventory_movements for select to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and (
        exists (select 1 from public.user_roles ur where ur.user_id = auth.uid() and ur.role_name = 'super_admin')
        or p.barbershop_id = inventory_movements.barbershop_id
      )
  )
);

drop policy if exists barbershop_catalogs_scoped_all on public.barbershop_catalogs;
create policy barbershop_catalogs_scoped_all on public.barbershop_catalogs for all to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and (
        exists (select 1 from public.user_roles ur where ur.user_id = auth.uid() and ur.role_name = 'super_admin')
        or p.barbershop_id = barbershop_catalogs.barbershop_id
      )
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and (
        exists (select 1 from public.user_roles ur where ur.user_id = auth.uid() and ur.role_name = 'super_admin')
        or p.barbershop_id = barbershop_catalogs.barbershop_id
      )
  )
);

alter table if exists public.services drop constraint if exists services_category_check;

grant execute on function public.register_inventory_movement_atomic(uuid, text, text, numeric, numeric, numeric, text, uuid, uuid, uuid, uuid, text, jsonb, uuid) to authenticated;
