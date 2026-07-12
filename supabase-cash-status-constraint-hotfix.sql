begin;

alter table if exists public.cash_sessions
  drop constraint if exists cash_sessions_status_check;

alter table if exists public.cash_sessions
  add constraint cash_sessions_status_check
  check (status in ('open', 'closed', 'abierta', 'cerrada', 'Abierta', 'Cerrada'));

update public.cash_sessions
set status = 'open'
where status in ('abierta', 'Abierta')
  and closed_at is null;

update public.cash_sessions
set status = 'closed'
where status in ('cerrada', 'Cerrada')
  or closed_at is not null;

alter table if exists public.cash_movements
  drop constraint if exists cash_movements_type_check;

alter table if exists public.cash_movements
  add constraint cash_movements_type_check
  check (type in ('in', 'out'));

alter table if exists public.cash_movements
  drop constraint if exists cash_movements_payment_method_check;

alter table if exists public.cash_movements
  add constraint cash_movements_payment_method_check
  check (payment_method in ('cash', 'card', 'transfer', 'mixed', 'other'));

alter table if exists public.cash_movements
  drop constraint if exists cash_movements_kind_check;

alter table if exists public.cash_movements
  add constraint cash_movements_kind_check
  check (movement_kind in ('opening', 'sale', 'manual', 'closing_adjustment', 'payroll_payment'));

notify pgrst, 'reload schema';

commit;
