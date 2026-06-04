alter table public.appointments
drop constraint if exists appointments_barber_id_appointment_date_appointment_time_key;

drop index if exists public.appointments_barber_id_appointment_date_appointment_time_key;

create unique index if not exists idx_appointments_active_barber_date_time
on public.appointments (barber_id, appointment_date, appointment_time)
where status in ('confirmada', 'en_espera', 'en_corte');
