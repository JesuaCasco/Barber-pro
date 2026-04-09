alter table public.pos_sales
  add column if not exists raw_subtotal numeric(12,2) not null default 0,
  add column if not exists discount_total numeric(12,2) not null default 0,
  add column if not exists promotion_id text,
  add column if not exists promotion_name text,
  add column if not exists discount_label text;

update public.pos_sales
set
  raw_subtotal = coalesce(raw_subtotal, subtotal, 0),
  discount_total = coalesce(discount_total, 0),
  promotion_name = coalesce(promotion_name, nullif(notes, '')),
  discount_label = coalesce(discount_label, promotion_name, nullif(notes, ''))
where
  raw_subtotal is null
  or discount_total is null
  or promotion_name is null
  or discount_label is null;
