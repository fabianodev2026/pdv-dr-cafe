-- Execute no Supabase SQL Editor para habilitar app de clientes,
-- almoco do dia, bebidas e pedidos pagar depois pelo app.

alter table public.products
  add column if not exists category text not null default 'comida';

create table if not exists public.daily_lunches (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  serving_date date not null unique,
  dish_name text not null check (char_length(dish_name) <= 30),
  description text,
  price numeric(10,2) not null default 0,
  image_url text,
  active boolean not null default true
);

alter table public.daily_lunches enable row level security;

drop policy if exists "daily lunches app read" on public.daily_lunches;
create policy "daily lunches app read"
on public.daily_lunches
for select
to anon, authenticated
using (true);

drop policy if exists "daily lunches app write" on public.daily_lunches;
create policy "daily lunches app write"
on public.daily_lunches
for all
to anon, authenticated
using (true)
with check (true);

create table if not exists public.app_customers (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  name text not null,
  phone text not null unique,
  position text not null,
  email text not null,
  status text not null default 'pendente',
  payment_day int not null default 5
);

alter table public.app_customers enable row level security;

drop policy if exists "app customers read" on public.app_customers;
create policy "app customers read"
on public.app_customers
for select
to anon, authenticated
using (true);

drop policy if exists "app customers insert" on public.app_customers;
create policy "app customers insert"
on public.app_customers
for insert
to anon, authenticated
with check (true);

drop policy if exists "app customers update" on public.app_customers;
create policy "app customers update"
on public.app_customers
for update
to anon, authenticated
using (true)
with check (true);

create table if not exists public.app_orders (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  customer_id bigint references public.app_customers(id),
  customer_name text not null,
  customer_phone text not null,
  items jsonb not null default '[]'::jsonb,
  total_amount numeric(10,2) not null default 0,
  status text not null default 'novo',
  customer_message text default 'Pedido enviado pelo app.'
);

alter table public.app_orders enable row level security;

drop policy if exists "app orders read" on public.app_orders;
create policy "app orders read"
on public.app_orders
for select
to anon, authenticated
using (true);

drop policy if exists "app orders insert" on public.app_orders;
create policy "app orders insert"
on public.app_orders
for insert
to anon, authenticated
with check (true);

drop policy if exists "app orders update" on public.app_orders;
create policy "app orders update"
on public.app_orders
for update
to anon, authenticated
using (true)
with check (true);
