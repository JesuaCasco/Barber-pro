alter table public.services enable row level security;
alter table public.service_combo_items enable row level security;

drop policy if exists services_scoped_read on public.services;
drop policy if exists services_manage_insert on public.services;
drop policy if exists services_manage_update on public.services;
drop policy if exists services_manage_delete on public.services;

create policy services_scoped_read
on public.services
for select
to authenticated
using (
  public.can_access_barbershop(barbershop_id)
);

create policy services_manage_insert
on public.services
for insert
to authenticated
with check (
  public.can_manage_branch(barbershop_id)
);

create policy services_manage_update
on public.services
for update
to authenticated
using (
  public.can_manage_branch(barbershop_id)
)
with check (
  public.can_manage_branch(barbershop_id)
);

create policy services_manage_delete
on public.services
for delete
to authenticated
using (
  public.can_manage_branch(barbershop_id)
);

drop policy if exists service_combo_items_authenticated_all on public.service_combo_items;
drop policy if exists service_combo_items_admin_scoped_all on public.service_combo_items;
drop policy if exists service_combo_items_admin_scope on public.service_combo_items;
drop policy if exists service_combo_items_scoped_all on public.service_combo_items;

create policy service_combo_items_scoped_all
on public.service_combo_items
for all
to authenticated
using (
  exists (
    select 1
    from public.services combo_service
    where combo_service.id = service_combo_items.combo_service_id
      and public.can_access_barbershop(combo_service.barbershop_id)
  )
)
with check (
  exists (
    select 1
    from public.services combo_service
    where combo_service.id = service_combo_items.combo_service_id
      and public.can_manage_branch(combo_service.barbershop_id)
  )
  and exists (
    select 1
    from public.services item_service
    join public.services combo_service on combo_service.id = service_combo_items.combo_service_id
    where item_service.id = service_combo_items.item_service_id
      and item_service.barbershop_id = combo_service.barbershop_id
  )
);

NOTIFY pgrst, 'reload config';
NOTIFY pgrst, 'reload schema';
