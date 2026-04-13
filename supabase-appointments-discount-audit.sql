begin;

alter table public.appointments
  add column if not exists gross_amount numeric(10,2) not null default 0;

alter table public.appointments
  add column if not exists discount_amount numeric(10,2) not null default 0;

alter table public.appointments
  add column if not exists promotion_name text;

update public.appointments
set
  gross_amount = coalesce(price, 0),
  discount_amount = coalesce(discount_amount, 0)
where gross_amount = 0;

commit;
