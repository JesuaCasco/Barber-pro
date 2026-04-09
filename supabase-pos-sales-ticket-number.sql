alter table public.pos_sales
add column if not exists ticket_number bigint;

do $$
begin
  if not exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where c.relkind = 'S'
      and c.relname = 'pos_sales_ticket_number_seq'
      and n.nspname = 'public'
  ) then
    create sequence public.pos_sales_ticket_number_seq;
  end if;
end
$$;

alter sequence public.pos_sales_ticket_number_seq owned by public.pos_sales.ticket_number;

alter table public.pos_sales
alter column ticket_number set default nextval('public.pos_sales_ticket_number_seq');

update public.pos_sales
set ticket_number = nextval('public.pos_sales_ticket_number_seq')
where ticket_number is null;

select setval(
  'public.pos_sales_ticket_number_seq',
  greatest((select coalesce(max(ticket_number), 0) from public.pos_sales), 1),
  true
);

alter table public.pos_sales
alter column ticket_number set not null;

create unique index if not exists idx_pos_sales_ticket_number
  on public.pos_sales (ticket_number);

grant delete on public.pos_sales to authenticated;

drop policy if exists pos_sales_delete_scoped on public.pos_sales;
create policy pos_sales_delete_scoped
on public.pos_sales
for delete
to authenticated
using (public.can_manage_branch(barbershop_id));
