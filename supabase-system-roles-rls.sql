create or replace function public.is_admin_user()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = auth.uid()
      and role_name = 'admin'
  );
$$;

grant execute on function public.is_admin_user() to authenticated;

alter table public.roles enable row level security;
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;

drop policy if exists roles_authenticated_read on public.roles;
create policy roles_authenticated_read
on public.roles
for select
to authenticated
using (true);

drop policy if exists profiles_authenticated_read on public.profiles;
create policy profiles_authenticated_read
on public.profiles
for select
to authenticated
using (true);

drop policy if exists user_roles_authenticated_read on public.user_roles;
create policy user_roles_authenticated_read
on public.user_roles
for select
to authenticated
using (true);

drop policy if exists user_roles_admin_insert on public.user_roles;
create policy user_roles_admin_insert
on public.user_roles
for insert
to authenticated
with check (public.is_admin_user());

drop policy if exists user_roles_admin_delete on public.user_roles;
create policy user_roles_admin_delete
on public.user_roles
for delete
to authenticated
using (public.is_admin_user());
