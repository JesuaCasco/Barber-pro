create table if not exists public.pos_sales (
  id uuid primary key,
  ticket_number bigint generated always as identity unique,
  barbershop_id uuid not null references public.barbershops(id) on delete cascade,
  branch_id uuid null references public.branches(id) on delete set null,
  raw_subtotal numeric(12,2) not null default 0,
  discount_total numeric(12,2) not null default 0,
  subtotal numeric(12,2) not null default 0,
  product_total numeric(12,2) not null default 0,
  service_total numeric(12,2) not null default 0,
  items jsonb not null default '[]'::jsonb,
  promotion_id text null,
  promotion_name text null,
  discount_label text null,
  notes text null,
  created_by uuid null references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_pos_sales_barbershop_created_at
  on public.pos_sales (barbershop_id, created_at desc);

create index if not exists idx_pos_sales_branch_created_at
  on public.pos_sales (branch_id, created_at desc);

grant select, insert, delete on public.pos_sales to authenticated;

alter table public.pos_sales enable row level security;

drop policy if exists pos_sales_read_scoped on public.pos_sales;
create policy pos_sales_read_scoped
on public.pos_sales
for select
to authenticated
using (public.can_access_barbershop(barbershop_id));

drop policy if exists pos_sales_insert_scoped on public.pos_sales;
create policy pos_sales_insert_scoped
on public.pos_sales
for insert
to authenticated
with check (public.can_manage_branch(barbershop_id));

drop policy if exists pos_sales_delete_scoped on public.pos_sales;
create policy pos_sales_delete_scoped
on public.pos_sales
for delete
to authenticated
using (public.can_manage_branch(barbershop_id));
