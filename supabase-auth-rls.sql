alter table public.clients enable row level security;
alter table public.barbers enable row level security;
alter table public.services enable row level security;
alter table public.service_combo_items enable row level security;
alter table public.appointments enable row level security;

drop policy if exists clients_authenticated_all on public.clients;
create policy clients_authenticated_all
on public.clients
for all
to authenticated
using (true)
with check (true);

drop policy if exists barbers_authenticated_all on public.barbers;
create policy barbers_authenticated_all
on public.barbers
for all
to authenticated
using (true)
with check (true);

drop policy if exists services_authenticated_all on public.services;
create policy services_authenticated_all
on public.services
for all
to authenticated
using (true)
with check (true);

drop policy if exists service_combo_items_authenticated_all on public.service_combo_items;
create policy service_combo_items_authenticated_all
on public.service_combo_items
for all
to authenticated
using (true)
with check (true);

drop policy if exists appointments_authenticated_all on public.appointments;
create policy appointments_authenticated_all
on public.appointments
for all
to authenticated
using (true)
with check (true);
