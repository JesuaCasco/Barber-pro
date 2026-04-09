-- Limpia los datos operativos de una barbería concreta
-- y vuelve a sembrar el staff base con sucursal asignada.
--
-- Antes de correrlo:
-- 1. Asegúrate de que la barbería exista.
-- 2. Asegúrate de que las sucursales también existan.
-- 3. Cambia los nombres de barbería/sucursal si en tu base usan otros.

begin;

do $$
declare
  v_barbershop_id uuid;
  v_branch_plaza uuid;
  v_branch_metro uuid;
begin
  select id
  into v_barbershop_id
  from public.barbershops
  where lower(name) = lower('Barbería 1')
  limit 1;

  if v_barbershop_id is null then
    raise exception 'No existe la barbería "Barbería 1".';
  end if;

  select id
  into v_branch_plaza
  from public.branches
  where barbershop_id = v_barbershop_id
    and lower(name) = lower('Plaza Inter')
  limit 1;

  if v_branch_plaza is null then
    raise exception 'No existe la sucursal "Plaza Inter" para "Barbería 1".';
  end if;

  select id
  into v_branch_metro
  from public.branches
  where barbershop_id = v_barbershop_id
    and lower(name) = lower('Metrocentro')
  limit 1;

  if v_branch_metro is null then
    raise exception 'No existe la sucursal "Metrocentro" para "Barbería 1".';
  end if;
end $$;

-- 1) Limpieza operativa de la barbería objetivo
with target_shop as (
  select id
  from public.barbershops
  where lower(name) = lower('Barbería 1')
  limit 1
),
target_sales as (
  select id
  from public.sales
  where barbershop_id = (select id from target_shop)
),
target_appointments as (
  select id
  from public.appointments
  where barbershop_id = (select id from target_shop)
)
delete from public.sale_items
where sale_id in (select id from target_sales);

with target_shop as (
  select id
  from public.barbershops
  where lower(name) = lower('Barbería 1')
  limit 1
),
target_appointments as (
  select id
  from public.appointments
  where barbershop_id = (select id from target_shop)
)
delete from public.appointment_history
where appointment_id in (select id from target_appointments);

delete from public.cash_movements
where barbershop_id = (
  select id
  from public.barbershops
  where lower(name) = lower('Barbería 1')
  limit 1
);

delete from public.sales
where barbershop_id = (
  select id
  from public.barbershops
  where lower(name) = lower('Barbería 1')
  limit 1
);

delete from public.cash_sessions
where barbershop_id = (
  select id
  from public.barbershops
  where lower(name) = lower('Barbería 1')
  limit 1
);

delete from public.expenses
where barbershop_id = (
  select id
  from public.barbershops
  where lower(name) = lower('Barbería 1')
  limit 1
);

delete from public.appointments
where barbershop_id = (
  select id
  from public.barbershops
  where lower(name) = lower('Barbería 1')
  limit 1
);

delete from public.clients
where barbershop_id = (
  select id
  from public.barbershops
  where lower(name) = lower('Barbería 1')
  limit 1
);

delete from public.barbers
where barbershop_id = (
  select id
  from public.barbershops
  where lower(name) = lower('Barbería 1')
  limit 1
);

-- 2) Inserción de barberos base por sucursal
with target_shop as (
  select id
  from public.barbershops
  where lower(name) = lower('Barbería 1')
  limit 1
),
seed as (
  select *
  from (
    values
      (
        'Juan "El Master"',
        'Juan Carlos Martínez López',
        '001-150890-1001A',
        '8889-4455',
        'JM',
        'border-indigo-500',
        'bg-indigo-600',
        'shadow-indigo-500/50',
        'salario',
        18000::numeric,
        0::numeric,
        'Quincenal',
        'Senior',
        'Plaza Inter'
      ),
      (
        'Luis "Barbas"',
        'Luis Alberto García Reyes',
        '001-120591-1002B',
        '8890-5522',
        'LB',
        'border-amber-500',
        'bg-amber-600',
        'shadow-amber-500/50',
        'salario',
        16000::numeric,
        0::numeric,
        'Mensual',
        'Junior',
        'Metrocentro'
      ),
      (
        'Mario "Fade"',
        'Mario José Hernández Ruiz',
        '001-190694-1003C',
        '8891-6611',
        'MF',
        'border-emerald-500',
        'bg-emerald-600',
        'shadow-emerald-500/50',
        'porcentaje',
        0::numeric,
        12::numeric,
        'Semanal',
        'Junior',
        'Metrocentro'
      ),
      (
        'Alex "Tijeras"',
        'Alex Manuel Torres Silva',
        '001-080492-1004D',
        '8892-7733',
        'AT',
        'border-rose-500',
        'bg-rose-600',
        'shadow-rose-500/50',
        'salario',
        15500::numeric,
        0::numeric,
        'Mensual',
        'Junior',
        'Plaza Inter'
      ),
      (
        'Pedro "Style"',
        'Pedro Antonio Castillo Vega',
        '001-140693-1005E',
        '8893-8844',
        'PS',
        'border-violet-500',
        'bg-violet-600',
        'shadow-violet-500/50',
        'salario',
        17000::numeric,
        0::numeric,
        'Quincenal',
        'Medium',
        'Metrocentro'
      ),
      (
        'Dani "Clipper"',
        'Daniel Enrique Morales Soto',
        '001-250795-1006F',
        '8894-9955',
        'DC',
        'border-cyan-500',
        'bg-cyan-600',
        'shadow-cyan-500/50',
        'porcentaje',
        0::numeric,
        15::numeric,
        'Diario',
        'Senior',
        'Plaza Inter'
      )
  ) as seeded(
    name,
    full_name,
    cedula,
    phone,
    avatar,
    color,
    bg,
    shadow,
    payment_mode,
    salary,
    commission,
    payment_frequency,
    level,
    branch_name
  )
)
insert into public.barbers (
  id,
  name,
  full_name,
  cedula,
  phone,
  payment_mode,
  salary,
  commission,
  payment_frequency,
  level,
  color,
  bg,
  shadow,
  avatar,
  is_active,
  barbershop_id,
  branch_id
)
select
  gen_random_uuid(),
  seed.name,
  seed.full_name,
  seed.cedula,
  seed.phone,
  seed.payment_mode,
  seed.salary,
  seed.commission,
  seed.payment_frequency,
  seed.level,
  seed.color,
  seed.bg,
  seed.shadow,
  seed.avatar,
  true,
  target_shop.id,
  branches.id
from seed
cross join target_shop
join public.branches
  on branches.barbershop_id = target_shop.id
 and lower(branches.name) = lower(seed.branch_name);

commit;

-- Confirmación rápida
select
  b.name as barbero,
  b.full_name,
  b.phone,
  b.payment_mode,
  b.commission,
  bs.name as barberia,
  br.name as sucursal
from public.barbers b
left join public.barbershops bs on bs.id = b.barbershop_id
left join public.branches br on br.id = b.branch_id
where lower(bs.name) = lower('Barbería 1')
order by br.name, b.name;
