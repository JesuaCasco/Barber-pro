create table if not exists public.payroll_settlements (
  id uuid primary key,
  barbershop_id uuid not null references public.barbershops(id) on delete cascade,
  branch_id uuid null references public.branches(id) on delete set null,
  barber_id uuid not null references public.barbers(id) on delete cascade,
  barber_name text not null,
  barber_full_name text null,
  gross_total numeric(12,2) not null default 0,
  withdrawals_total numeric(12,2) not null default 0,
  net_total numeric(12,2) not null default 0,
  pending_services integer not null default 0,
  settlement_type text not null default 'individual',
  notes text null,
  paid_by uuid null references public.profiles(id) on delete set null,
  paid_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  constraint payroll_settlements_type_check
    check (settlement_type in ('individual', 'staff'))
);

create table if not exists public.barber_cash_advances (
  id uuid primary key,
  barbershop_id uuid not null references public.barbershops(id) on delete cascade,
  branch_id uuid null references public.branches(id) on delete set null,
  barber_id uuid not null references public.barbers(id) on delete cascade,
  barber_name text not null,
  amount numeric(12,2) not null,
  note text null,
  advance_date date not null default current_date,
  created_by uuid null references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  settled_at timestamptz null,
  settlement_id uuid null references public.payroll_settlements(id) on delete set null,
  constraint barber_cash_advances_amount_check check (amount > 0)
);

create table if not exists public.payroll_settlement_appointments (
  settlement_id uuid not null references public.payroll_settlements(id) on delete cascade,
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  barbershop_id uuid not null references public.barbershops(id) on delete cascade,
  branch_id uuid null references public.branches(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (settlement_id, appointment_id)
);

alter table public.appointments
add column if not exists paid_at timestamptz null,
add column if not exists paid_by uuid null references public.profiles(id) on delete set null,
add column if not exists settlement_id uuid null references public.payroll_settlements(id) on delete set null;

create index if not exists idx_barber_cash_advances_barber_pending
  on public.barber_cash_advances (barber_id, settled_at, advance_date desc);

create index if not exists idx_barber_cash_advances_scope_created
  on public.barber_cash_advances (barbershop_id, branch_id, created_at desc);

create index if not exists idx_payroll_settlements_barber_paid
  on public.payroll_settlements (barber_id, paid_at desc);

create index if not exists idx_payroll_settlements_scope_paid
  on public.payroll_settlements (barbershop_id, branch_id, paid_at desc);

create index if not exists idx_payroll_settlement_appointments_appointment
  on public.payroll_settlement_appointments (appointment_id);

create index if not exists idx_appointments_settlement_id
  on public.appointments (settlement_id);

grant select, insert, update on public.barber_cash_advances to authenticated;
grant select, insert on public.payroll_settlements to authenticated;
grant select, insert, delete on public.payroll_settlement_appointments to authenticated;

alter table public.barber_cash_advances enable row level security;
alter table public.payroll_settlements enable row level security;
alter table public.payroll_settlement_appointments enable row level security;

drop policy if exists barber_cash_advances_read_scoped on public.barber_cash_advances;
create policy barber_cash_advances_read_scoped
on public.barber_cash_advances
for select
to authenticated
using (public.can_access_barbershop(barbershop_id));

drop policy if exists barber_cash_advances_insert_scoped on public.barber_cash_advances;
create policy barber_cash_advances_insert_scoped
on public.barber_cash_advances
for insert
to authenticated
with check (public.can_access_barbershop(barbershop_id));

drop policy if exists barber_cash_advances_update_scoped on public.barber_cash_advances;
create policy barber_cash_advances_update_scoped
on public.barber_cash_advances
for update
to authenticated
using (public.can_access_barbershop(barbershop_id))
with check (public.can_access_barbershop(barbershop_id));

drop policy if exists payroll_settlements_read_scoped on public.payroll_settlements;
create policy payroll_settlements_read_scoped
on public.payroll_settlements
for select
to authenticated
using (public.can_access_barbershop(barbershop_id));

drop policy if exists payroll_settlements_insert_scoped on public.payroll_settlements;
create policy payroll_settlements_insert_scoped
on public.payroll_settlements
for insert
to authenticated
with check (public.can_access_barbershop(barbershop_id));

drop policy if exists payroll_settlement_appointments_read_scoped on public.payroll_settlement_appointments;
create policy payroll_settlement_appointments_read_scoped
on public.payroll_settlement_appointments
for select
to authenticated
using (public.can_access_barbershop(barbershop_id));

drop policy if exists payroll_settlement_appointments_insert_scoped on public.payroll_settlement_appointments;
create policy payroll_settlement_appointments_insert_scoped
on public.payroll_settlement_appointments
for insert
to authenticated
with check (public.can_access_barbershop(barbershop_id));

drop policy if exists payroll_settlement_appointments_delete_scoped on public.payroll_settlement_appointments;
create policy payroll_settlement_appointments_delete_scoped
on public.payroll_settlement_appointments
for delete
to authenticated
using (public.can_access_barbershop(barbershop_id));
