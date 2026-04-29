-- Execute no Supabase SQL Editor.
-- Corrige RLS de vendas, forma de pagamento, pedidos e pagar depois.

create table if not exists public.sales (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  table_number int,
  total_amount numeric(10,2) not null default 0,
  cashier_name text,
  customer_name text,
  customer_phone text,
  items jsonb not null default '[]'::jsonb,
  payment_method text
);

alter table public.sales
  add column if not exists customer_name text,
  add column if not exists customer_phone text,
  add column if not exists items jsonb not null default '[]'::jsonb,
  add column if not exists payment_method text;

alter table public.sales enable row level security;

drop policy if exists "sales app insert" on public.sales;
create policy "sales app insert"
on public.sales
for insert
to anon, authenticated
with check (true);

drop policy if exists "sales app read" on public.sales;
create policy "sales app read"
on public.sales
for select
to anon, authenticated
using (true);

alter table public.room_orders
  add column if not exists customer_message text default 'Pedido enviado para o PDV.';

alter table public.pending_payments
  add column if not exists items_detail text;
