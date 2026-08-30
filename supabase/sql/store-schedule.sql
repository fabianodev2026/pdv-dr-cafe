-- Horario de funcionamento do app, configuravel pelo administrador.
-- Execute no Supabase SQL Editor antes de usar a aba "Funcionamento" em Configuracoes.

create table if not exists public.store_schedule (
  id integer primary key default 1,
  weekday_open time not null default '08:00',
  weekday_close time not null default '20:00',
  saturday_open time not null default '08:00',
  saturday_close time not null default '14:30',
  sunday_enabled boolean not null default false,
  sunday_open time not null default '08:00',
  sunday_close time not null default '14:00',
  updated_at timestamptz not null default now(),
  constraint store_schedule_single_row check (id = 1)
);

insert into public.store_schedule (id)
values (1)
on conflict (id) do nothing;

alter table public.store_schedule enable row level security;

drop policy if exists "store schedule app read" on public.store_schedule;
create policy "store schedule app read"
on public.store_schedule
for select
using (true);

drop policy if exists "store schedule app update" on public.store_schedule;
create policy "store schedule app update"
on public.store_schedule
for update
using (true)
with check (true);

drop policy if exists "store schedule app insert" on public.store_schedule;
create policy "store schedule app insert"
on public.store_schedule
for insert
with check (true);

grant select, insert, update on public.store_schedule to anon, authenticated;

notify pgrst, 'reload schema';
