-- Correcao completa para cadastro do app de clientes Dr. Cafe.
-- Rode este arquivo no Supabase SQL Editor quando o app mostrar erro ao cadastrar.
-- Depois de executar, clique em "Refresh schema cache" se o painel do Supabase oferecer essa opcao.

create extension if not exists pgcrypto;

alter table public.products
  add column if not exists category text not null default 'comida';

create table if not exists public.daily_lunches (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  serving_date date not null unique,
  dish_name text not null,
  description text,
  price numeric(10,2) not null default 0,
  image_url text,
  active boolean not null default true
);

alter table public.daily_lunches
  drop constraint if exists daily_lunches_dish_name_length,
  add constraint daily_lunches_dish_name_length
  check (char_length(dish_name) <= 30) not valid;

create table if not exists public.app_customers (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  name text not null,
  login text not null,
  password_hash text not null,
  phone text not null,
  position text not null,
  email text not null,
  status text not null default 'pendente',
  payment_day int not null default 5,
  credit_limit numeric(10,2) not null default 0
);

alter table public.app_customers
  add column if not exists login text,
  add column if not exists password_hash text,
  add column if not exists status text not null default 'pendente',
  add column if not exists payment_day int not null default 5,
  add column if not exists credit_limit numeric(10,2) not null default 0;

update public.app_customers
set
  login = coalesce(nullif(login, ''), upper(regexp_replace(phone, '\D', '', 'g'))),
  password_hash = coalesce(nullif(password_hash, ''), crypt('trocar-senha', gen_salt('bf', 10)))
where login is null
   or login = ''
   or password_hash is null
   or password_hash = '';

alter table public.app_customers
  alter column login set not null,
  alter column password_hash set not null;

alter table public.app_customers
  drop constraint if exists app_customers_name_length,
  add constraint app_customers_name_length check (char_length(name) <= 25) not valid;

alter table public.app_customers
  drop constraint if exists app_customers_login_length,
  add constraint app_customers_login_length check (char_length(login) <= 20) not valid;

alter table public.app_customers
  drop constraint if exists app_customers_position_length,
  add constraint app_customers_position_length check (char_length(position) <= 20) not valid;

alter table public.app_customers
  drop constraint if exists app_customers_email_length,
  add constraint app_customers_email_length check (char_length(email) <= 30) not valid;

alter table public.app_customers
  drop constraint if exists app_customers_status_check,
  add constraint app_customers_status_check
  check (status in ('pendente', 'ativo', 'bloqueado')) not valid;

alter table public.app_customers
  drop constraint if exists app_customers_credit_limit_positive,
  add constraint app_customers_credit_limit_positive
  check (credit_limit >= 0) not valid;

create unique index if not exists app_customers_phone_key
on public.app_customers (phone);

create unique index if not exists app_customers_login_key
on public.app_customers (login);

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

alter table public.daily_lunches enable row level security;
alter table public.app_customers enable row level security;
alter table public.app_orders enable row level security;

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
