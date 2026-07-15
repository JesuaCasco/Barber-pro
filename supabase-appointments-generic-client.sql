-- Permite registrar citas o turnos con cliente generico sin crear una ficha en clients.
alter table public.appointments
  add column if not exists client_name text;

alter table public.appointments
  alter column client_id drop not null;

comment on column public.appointments.client_name is
  'Nombre libre del cliente cuando no existe client_id, por ejemplo Cliente generico.';