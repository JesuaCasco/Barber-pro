alter table public.inventory_items
  add column if not exists presentation_name text not null default 'unidad',
  add column if not exists units_per_presentation numeric not null default 1;

alter table public.inventory_items
  drop constraint if exists inventory_items_units_per_presentation_check;

alter table public.inventory_items
  add constraint inventory_items_units_per_presentation_check
  check (units_per_presentation > 0);

comment on column public.inventory_items.presentation_name is
  'Presentacion comercial de compra o almacenaje, por ejemplo caja, paquete, frasco.';

comment on column public.inventory_items.units_per_presentation is
  'Cantidad de unidades de control contenidas en cada presentacion. Ejemplo: caja de 100 cuchillas.';
