create extension if not exists pgcrypto;

create table if not exists public.branches (
  id uuid primary key default gen_random_uuid(),
  barbershop_id uuid not null references public.barbershops(id) on delete cascade,
  name text not null,
  code text,
  city text,
  address text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_branches_barbershop_id
on public.branches (barbershop_id);

create unique index if not exists idx_branches_barbershop_name
on public.branches (barbershop_id, lower(name));

alter table public.profiles
add column if not exists branch_id uuid references public.branches(id) on delete set null;

alter table public.clients
add column if not exists branch_id uuid references public.branches(id) on delete set null;

alter table public.barbers
add column if not exists branch_id uuid references public.branches(id) on delete set null;

alter table public.services
add column if not exists branch_id uuid references public.branches(id) on delete set null;

alter table public.appointments
add column if not exists branch_id uuid references public.branches(id) on delete set null;

create index if not exists idx_profiles_branch_id on public.profiles (branch_id);
create index if not exists idx_clients_branch_id on public.clients (branch_id);
create index if not exists idx_barbers_branch_id on public.barbers (branch_id);
create index if not exists idx_services_branch_id on public.services (branch_id);
create index if not exists idx_appointments_branch_id on public.appointments (branch_id);

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

create or replace function public.can_access_barbershop(target_barbershop_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select
    public.is_super_admin_user()
    or exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.barbershop_id = target_barbershop_id
    );
$$;

create or replace function public.can_manage_branch(target_barbershop_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select
    public.is_super_admin_user()
    or exists (
      select 1
      from public.profiles p
      join public.user_roles ur on ur.user_id = p.id
      where p.id = auth.uid()
        and p.barbershop_id = target_barbershop_id
        and ur.role_name = 'admin'
    );
$$;

grant execute on function public.has_role(text) to authenticated;
grant execute on function public.is_super_admin_user() to authenticated;
grant execute on function public.can_access_barbershop(uuid) to authenticated;
grant execute on function public.can_manage_branch(uuid) to authenticated;

alter table public.branches enable row level security;

drop policy if exists branches_scoped_read on public.branches;
create policy branches_scoped_read
on public.branches
for select
to authenticated
using (public.can_access_barbershop(barbershop_id));

drop policy if exists branches_manage_insert on public.branches;
create policy branches_manage_insert
on public.branches
for insert
to authenticated
with check (public.can_manage_branch(barbershop_id));

drop policy if exists branches_manage_update on public.branches;
create policy branches_manage_update
on public.branches
for update
to authenticated
using (public.can_manage_branch(barbershop_id))
with check (public.can_manage_branch(barbershop_id));

drop policy if exists branches_manage_delete on public.branches;
create policy branches_manage_delete
on public.branches
for delete
to authenticated
using (public.can_manage_branch(barbershop_id));
