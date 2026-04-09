create extension if not exists pgcrypto;

create table if not exists public.barbershops (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  owner_email text,
  phone text,
  city text,
  plan text not null default 'Starter',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_barbershops_slug on public.barbershops (slug);

alter table if exists public.profiles add column if not exists barbershop_id uuid references public.barbershops(id) on delete set null;
alter table if exists public.clients add column if not exists barbershop_id uuid references public.barbershops(id) on delete set null;
alter table if exists public.barbers add column if not exists barbershop_id uuid references public.barbershops(id) on delete set null;
alter table if exists public.services add column if not exists barbershop_id uuid references public.barbershops(id) on delete set null;
alter table if exists public.service_combo_items add column if not exists barbershop_id uuid references public.barbershops(id) on delete set null;
alter table if exists public.appointments add column if not exists barbershop_id uuid references public.barbershops(id) on delete set null;
alter table if exists public.sales add column if not exists barbershop_id uuid references public.barbershops(id) on delete set null;
alter table if exists public.sale_items add column if not exists barbershop_id uuid references public.barbershops(id) on delete set null;
alter table if exists public.cash_movements add column if not exists barbershop_id uuid references public.barbershops(id) on delete set null;
alter table if exists public.cash_sessions add column if not exists barbershop_id uuid references public.barbershops(id) on delete set null;
alter table if exists public.expenses add column if not exists barbershop_id uuid references public.barbershops(id) on delete set null;

create index if not exists idx_profiles_barbershop_id on public.profiles (barbershop_id);
create index if not exists idx_clients_barbershop_id on public.clients (barbershop_id);
create index if not exists idx_barbers_barbershop_id on public.barbers (barbershop_id);
create index if not exists idx_services_barbershop_id on public.services (barbershop_id);
create index if not exists idx_appointments_barbershop_id on public.appointments (barbershop_id);
create index if not exists idx_sales_barbershop_id on public.sales (barbershop_id);
create index if not exists idx_sale_items_barbershop_id on public.sale_items (barbershop_id);
create index if not exists idx_cash_movements_barbershop_id on public.cash_movements (barbershop_id);
create index if not exists idx_cash_sessions_barbershop_id on public.cash_sessions (barbershop_id);
create index if not exists idx_expenses_barbershop_id on public.expenses (barbershop_id);

insert into public.roles (role_name, description)
values
  ('super_admin', 'Control total de la plataforma SaaS'),
  ('admin', 'Administra una barbería y su configuración'),
  ('cashier', 'Opera agenda, clientes y caja')
on conflict (role_name) do update
set description = excluded.description;

delete from public.user_roles where role_name = 'barber';
delete from public.roles where role_name = 'barber';

insert into public.profiles (id, email, full_name)
select
  u.id,
  u.email,
  coalesce(u.raw_user_meta_data->>'full_name', u.email)
from auth.users u
on conflict (id) do update
set
  email = excluded.email,
  full_name = excluded.full_name;

insert into public.user_roles (user_id, role_name)
select u.id, 'super_admin'
from auth.users u
where lower(u.email) = lower('jesuajc15@gmail.com')
on conflict (user_id, role_name) do nothing;

create or replace function public.has_role(target_role text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = auth.uid()
      and role_name = target_role
  );
$$;

create or replace function public.is_super_admin_user()
returns boolean
language sql
security definer
set search_path = public
as $$
  select public.has_role('super_admin');
$$;

create or replace function public.is_shop_admin_user()
returns boolean
language sql
security definer
set search_path = public
as $$
  select public.has_role('super_admin') or public.has_role('admin');
$$;

create or replace function public.current_barbershop_id()
returns uuid
language sql
security definer
set search_path = public
as $$
  select barbershop_id
  from public.profiles
  where id = auth.uid();
$$;

create or replace function public.can_access_barbershop(target_barbershop_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select
    public.is_super_admin_user()
    or (
      target_barbershop_id is not null
      and target_barbershop_id = public.current_barbershop_id()
    );
$$;

create or replace function public.can_manage_role_for_user(target_user_id uuid, desired_role text default null)
returns boolean
language sql
security definer
set search_path = public
as $$
  select
    public.is_super_admin_user()
    or (
      public.is_shop_admin_user()
      and desired_role is distinct from 'super_admin'
      and exists (
        select 1
        from public.profiles target_profile
        where target_profile.id = target_user_id
          and target_profile.barbershop_id = public.current_barbershop_id()
      )
    );
$$;

grant execute on function public.has_role(text) to authenticated;
grant execute on function public.is_super_admin_user() to authenticated;
grant execute on function public.is_shop_admin_user() to authenticated;
grant execute on function public.current_barbershop_id() to authenticated;
grant execute on function public.can_access_barbershop(uuid) to authenticated;
grant execute on function public.can_manage_role_for_user(uuid, text) to authenticated;

alter table public.roles enable row level security;
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.barbershops enable row level security;
alter table public.clients enable row level security;
alter table public.barbers enable row level security;
alter table public.services enable row level security;
alter table public.service_combo_items enable row level security;
alter table public.appointments enable row level security;
alter table public.sales enable row level security;
alter table public.sale_items enable row level security;
alter table public.cash_movements enable row level security;
alter table public.cash_sessions enable row level security;
alter table public.expenses enable row level security;

drop policy if exists roles_authenticated_read on public.roles;
create policy roles_authenticated_read
on public.roles
for select
to authenticated
using (true);

drop policy if exists profiles_scoped_read on public.profiles;
create policy profiles_scoped_read
on public.profiles
for select
to authenticated
using (
  id = auth.uid()
  or public.is_super_admin_user()
  or public.can_access_barbershop(barbershop_id)
);

drop policy if exists profiles_super_admin_update on public.profiles;
create policy profiles_super_admin_update
on public.profiles
for update
to authenticated
using (public.is_super_admin_user())
with check (public.is_super_admin_user());

drop policy if exists user_roles_scoped_read on public.user_roles;
create policy user_roles_scoped_read
on public.user_roles
for select
to authenticated
using (
  user_id = auth.uid()
  or public.is_super_admin_user()
  or exists (
    select 1
    from public.profiles target_profile
    where target_profile.id = user_roles.user_id
      and public.can_access_barbershop(target_profile.barbershop_id)
  )
);

drop policy if exists user_roles_manage_insert on public.user_roles;
create policy user_roles_manage_insert
on public.user_roles
for insert
to authenticated
with check (public.can_manage_role_for_user(user_id, role_name));

drop policy if exists user_roles_manage_delete on public.user_roles;
create policy user_roles_manage_delete
on public.user_roles
for delete
to authenticated
using (public.can_manage_role_for_user(user_id, role_name));

drop policy if exists barbershops_select on public.barbershops;
create policy barbershops_select
on public.barbershops
for select
to authenticated
using (
  public.is_super_admin_user()
  or id = public.current_barbershop_id()
);

drop policy if exists barbershops_manage on public.barbershops;
create policy barbershops_manage
on public.barbershops
for all
to authenticated
using (public.is_super_admin_user())
with check (public.is_super_admin_user());

drop policy if exists clients_scoped_all on public.clients;
create policy clients_scoped_all
on public.clients
for all
to authenticated
using (public.can_access_barbershop(barbershop_id))
with check (public.can_access_barbershop(barbershop_id));

drop policy if exists appointments_scoped_all on public.appointments;
create policy appointments_scoped_all
on public.appointments
for all
to authenticated
using (public.can_access_barbershop(barbershop_id))
with check (public.can_access_barbershop(barbershop_id));

drop policy if exists sales_scoped_all on public.sales;
create policy sales_scoped_all
on public.sales
for all
to authenticated
using (public.can_access_barbershop(barbershop_id))
with check (public.can_access_barbershop(barbershop_id));

drop policy if exists sale_items_scoped_all on public.sale_items;
create policy sale_items_scoped_all
on public.sale_items
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

drop policy if exists cash_sessions_scoped_all on public.cash_sessions;
create policy cash_sessions_scoped_all
on public.cash_sessions
for all
to authenticated
using (public.can_access_barbershop(barbershop_id))
with check (public.can_access_barbershop(barbershop_id));

drop policy if exists barbers_admin_scoped_all on public.barbers;
create policy barbers_admin_scoped_all
on public.barbers
for all
to authenticated
using (public.is_shop_admin_user() and public.can_access_barbershop(barbershop_id))
with check (public.is_shop_admin_user() and public.can_access_barbershop(barbershop_id));

drop policy if exists services_admin_scoped_all on public.services;
create policy services_admin_scoped_all
on public.services
for all
to authenticated
using (public.is_shop_admin_user() and public.can_access_barbershop(barbershop_id))
with check (public.is_shop_admin_user() and public.can_access_barbershop(barbershop_id));

drop policy if exists service_combo_items_admin_scoped_all on public.service_combo_items;
create policy service_combo_items_admin_scoped_all
on public.service_combo_items
for all
to authenticated
using (public.is_shop_admin_user() and public.can_access_barbershop(barbershop_id))
with check (public.is_shop_admin_user() and public.can_access_barbershop(barbershop_id));

drop policy if exists expenses_admin_scoped_all on public.expenses;
create policy expenses_admin_scoped_all
on public.expenses
for all
to authenticated
using (public.is_shop_admin_user() and public.can_access_barbershop(barbershop_id))
with check (public.is_shop_admin_user() and public.can_access_barbershop(barbershop_id));
