-- Execute no Supabase SQL Editor para habilitar pedidos de quartos e pagar depois.

create table if not exists public.room_orders (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  room_number int not null check (room_number between 101 and 315),
  patient_name text not null,
  phone text not null,
  items jsonb not null default '[]'::jsonb,
  total_amount numeric(10,2) not null default 0,
  status text not null default 'novo',
  customer_message text default 'Pedido enviado para o PDV.'
);

alter table public.room_orders enable row level security;

drop policy if exists "room orders can be created publicly" on public.room_orders;
create policy "room orders can be created publicly"
on public.room_orders
for insert
to anon, authenticated
with check (room_number between 101 and 315);

drop policy if exists "room orders can be read by app" on public.room_orders;
create policy "room orders can be read by app"
on public.room_orders
for select
to anon, authenticated
using (true);

drop policy if exists "room orders can be updated by app" on public.room_orders;
create policy "room orders can be updated by app"
on public.room_orders
for update
to anon, authenticated
using (true)
with check (true);

create table if not exists public.pending_payments (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  customer_name text not null,
  phone text not null,
  position text,
  description text,
  items_detail text,
  total_amount numeric(10,2) not null default 0,
  purchase_date date not null default current_date,
  due_date date not null,
  status text not null default 'pendente'
);

alter table public.pending_payments enable row level security;

drop policy if exists "pending payments app read" on public.pending_payments;
create policy "pending payments app read"
on public.pending_payments
for select
to anon, authenticated
using (true);

drop policy if exists "pending payments app insert" on public.pending_payments;
create policy "pending payments app insert"
on public.pending_payments
for insert
to anon, authenticated
with check (true);

drop policy if exists "pending payments app update" on public.pending_payments;
create policy "pending payments app update"
on public.pending_payments
for update
to anon, authenticated
using (true)
with check (true);
