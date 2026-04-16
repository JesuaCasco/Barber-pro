begin;

update public.barbers
set payment_mode = 'salario'
where payment_mode is null
   or btrim(payment_mode) = '';

alter table public.barbers
drop constraint if exists barbers_payment_mode_check;

alter table public.barbers
add constraint barbers_payment_mode_check
check (payment_mode in ('salario', 'porcentaje', 'mixto'));

commit;
