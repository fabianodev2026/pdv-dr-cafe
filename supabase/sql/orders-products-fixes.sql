-- Execute no Supabase SQL Editor.
-- Libera apagar/editar produtos e cria pedidos internos de mesas/quartos.

alter table public.products enable row level security;

drop policy if exists "products app read" on public.products;
create policy "products app read"
on public.products
for select
to anon, authenticated
using (true);

drop policy if exists "products app insert" on public.products;
create policy "products app insert"
on public.products
for insert
to anon, authenticated
with check (true);

drop policy if exists "products app update" on public.products;
create policy "products app update"
on public.products
for update
to anon, authenticated
using (true)
with check (true);

drop policy if exists "products app delete" on public.products;
create policy "products app delete"
on public.products
for delete
to anon, authenticated
using (true);

create table if not exists public.service_orders (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  source_type text not null check (source_type in ('mesa', 'quarto')),
  service_number int not null,
  customer_name text,
  customer_phone text,
  items jsonb not null default '[]'::jsonb,
  total_amount numeric(10,2) not null default 0,
  status text not null default 'recebido',
  customer_message text default 'Pedido recebido pelo PDV.'
);

alter table public.service_orders enable row level security;

drop policy if exists "service orders app read" on public.service_orders;
create policy "service orders app read"
on public.service_orders
for select
to anon, authenticated
using (true);

drop policy if exists "service orders app insert" on public.service_orders;
create policy "service orders app insert"
on public.service_orders
for insert
to anon, authenticated
with check (true);

drop policy if exists "service orders app update" on public.service_orders;
create policy "service orders app update"
on public.service_orders
for update
to anon, authenticated
using (true)
with check (true);
