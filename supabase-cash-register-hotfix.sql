begin;

alter table if exists public.cash_sessions
  add column if not exists barbershop_id uuid references public.barbershops(id) on delete cascade,
  add column if not exists branch_id uuid references public.branches(id) on delete set null,
  add column if not exists opened_by uuid references public.profiles(id) on delete set null,
  add column if not exists closed_by uuid references public.profiles(id) on delete set null,
  add column if not exists opened_at timestamptz not null default now(),
  add column if not exists closed_at timestamptz,
  add column if not exists opening_amount numeric(12,2) not null default 0,
  add column if not exists closing_amount numeric(12,2),
  add column if not exists status text not null default 'open',
  add column if not exists expected_cash_amount numeric(12,2) not null default 0,
  add column if not exists counted_cash_amount numeric(12,2),
  add column if not exists difference_amount numeric(12,2),
  add column if not exists notes text;

alter table if exists public.cash_movements
  add column if not exists cash_session_id uuid references public.cash_sessions(id) on delete cascade,
  add column if not exists barbershop_id uuid references public.barbershops(id) on delete cascade,
  add column if not exists branch_id uuid references public.branches(id) on delete set null,
  add column if not exists type text,
  add column if not exists amount numeric(12,2) not null default 0,
  add column if not exists notes text,
  add column if not exists created_by uuid references public.profiles(id) on delete set null,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists movement_kind text not null default 'manual',
  add column if not exists payment_method text not null default 'cash',
  add column if not exists reference_type text,
  add column if not exists reference_id uuid;

alter table if exists public.pos_sales
  add column if not exists cash_session_id uuid references public.cash_sessions(id) on delete set null,
  add column if not exists payment_method text not null default 'cash',
  add column if not exists client_id uuid references public.clients(id) on delete set null,
  add column if not exists client_name text;

notify pgrst, 'reload schema';

commit;
