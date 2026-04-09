alter table public.services
  add column if not exists applies_to text,
  add column if not exists discount_type text,
  add column if not exists discount_value numeric(12,2) not null default 0,
  add column if not exists target_service_ids jsonb not null default '[]'::jsonb,
  add column if not exists is_optional boolean not null default true;

update public.services
set
  applies_to = case when category = 'Promocion' then coalesce(applies_to, 'Servicio') else null end,
  discount_type = case when category = 'Promocion' then coalesce(discount_type, 'percentage') else null end,
  discount_value = case when category = 'Promocion' then coalesce(discount_value, 0) else 0 end,
  target_service_ids = case
    when category = 'Promocion' and jsonb_typeof(target_service_ids) = 'array' then target_service_ids
    when category = 'Promocion' then '[]'::jsonb
    else '[]'::jsonb
  end,
  is_optional = case when category = 'Promocion' then coalesce(is_optional, true) else true end;

alter table public.services
  drop constraint if exists services_applies_to_check;

alter table public.services
  add constraint services_applies_to_check
  check (
    applies_to is null
    or applies_to in ('Servicio', 'Producto')
  );

alter table public.services
  drop constraint if exists services_discount_type_check;

alter table public.services
  add constraint services_discount_type_check
  check (
    discount_type is null
    or discount_type in ('percentage', 'fixed')
  );
