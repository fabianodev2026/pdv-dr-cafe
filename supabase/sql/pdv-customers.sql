-- Clientes cadastrados pelo PDV para marcar compras sem usar o app.
-- Execute no Supabase SQL Editor antes de usar o cadastro na tela Pagar depois.

create table if not exists public.pdv_customers (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  name text not null,
  phone text not null,
  position text,
  notes text,
  status text not null default 'ativo'
);

alter table public.pdv_customers
  drop constraint if exists pdv_customers_name_length,
  add constraint pdv_customers_name_length
  check (char_length(name) <= 60) not valid;

alter table public.pdv_customers
  drop constraint if exists pdv_customers_phone_length,
  add constraint pdv_customers_phone_length
  check (char_length(phone) <= 25) not valid;

alter table public.pdv_customers
  drop constraint if exists pdv_customers_status_check,
  add constraint pdv_customers_status_check
  check (status in ('ativo', 'bloqueado')) not valid;

create index if not exists pdv_customers_name_idx
on public.pdv_customers (name);

create unique index if not exists pdv_customers_phone_unique_idx
on public.pdv_customers (phone);

alter table public.pdv_customers enable row level security;

drop policy if exists "pdv customers app read" on public.pdv_customers;
create policy "pdv customers app read"
on public.pdv_customers
for select
using (true);

drop policy if exists "pdv customers app insert" on public.pdv_customers;
create policy "pdv customers app insert"
on public.pdv_customers
for insert
with check (true);

drop policy if exists "pdv customers app update" on public.pdv_customers;
create policy "pdv customers app update"
on public.pdv_customers
for update
using (true)
with check (true);

drop policy if exists "pdv customers app delete" on public.pdv_customers;
create policy "pdv customers app delete"
on public.pdv_customers
for delete
using (true);

grant select, insert, update, delete on public.pdv_customers to anon, authenticated;
grant usage, select on sequence public.pdv_customers_id_seq to anon, authenticated;

notify pgrst, 'reload schema';
