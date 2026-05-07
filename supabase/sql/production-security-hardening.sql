-- Endurecimento de producao do PDV Dr. Cafe.
--
-- Execute este arquivo somente depois de mover o sistema interno para
-- Supabase Auth ou para um backend proprio que envie JWT com app_metadata.role.
-- Ele remove politicas abertas usadas no desenvolvimento.

create extension if not exists pgcrypto;

create or replace function public.current_pdv_role()
returns text
language sql
stable
as $$
  select coalesce(
    nullif(auth.jwt() -> 'app_metadata' ->> 'role', ''),
    nullif(auth.jwt() -> 'user_metadata' ->> 'role', '')
  );
$$;

create or replace function public.is_pdv_manager()
returns boolean
language sql
stable
as $$
  select public.current_pdv_role() in ('admin', 'gerente');
$$;

create or replace function public.is_pdv_admin()
returns boolean
language sql
stable
as $$
  select public.current_pdv_role() = 'admin';
$$;

create or replace function public.is_pdv_support()
returns boolean
language sql
stable
as $$
  select public.current_pdv_role() = 'suporte_tecnico';
$$;

create or replace function public.is_pdv_operator()
returns boolean
language sql
stable
as $$
  select public.current_pdv_role() in ('admin', 'gerente', 'caixa', 'garcom', 'suporte_tecnico');
$$;

-- Evita leitura direta de tabelas pelo papel anonimo do frontend.
revoke all on table
  public.app_customers,
  public.app_orders,
  public.daily_lunches,
  public.fiscal_requests,
  public.pending_payments,
  public.pdv_users,
  public.products,
  public.room_orders,
  public.sales,
  public.service_orders,
  public.support_ai_reviews
from anon;

grant select on public.products to anon, authenticated;
grant select on public.daily_lunches to anon, authenticated;
grant insert on public.room_orders to anon, authenticated;
grant insert on public.app_orders to anon, authenticated;
grant insert on public.app_customers to anon, authenticated;

grant select, insert, update, delete on table
  public.app_customers,
  public.app_orders,
  public.daily_lunches,
  public.fiscal_requests,
  public.pending_payments,
  public.products,
  public.room_orders,
  public.sales,
  public.service_orders,
  public.support_ai_reviews
to authenticated;

alter table public.products enable row level security;
alter table public.daily_lunches enable row level security;
alter table public.room_orders enable row level security;
alter table public.service_orders enable row level security;
alter table public.sales enable row level security;
alter table public.pending_payments enable row level security;
alter table public.app_customers enable row level security;
alter table public.app_orders enable row level security;
alter table public.fiscal_requests enable row level security;
alter table public.support_ai_reviews enable row level security;
alter table public.pdv_users enable row level security;

-- Remove nomes de politicas abertas criadas nos scripts de desenvolvimento.
drop policy if exists "products app read" on public.products;
drop policy if exists "products app insert" on public.products;
drop policy if exists "products app update" on public.products;
drop policy if exists "products app delete" on public.products;
drop policy if exists "daily lunches app read" on public.daily_lunches;
drop policy if exists "daily lunches app write" on public.daily_lunches;
drop policy if exists "room orders can be created publicly" on public.room_orders;
drop policy if exists "room orders can be read by app" on public.room_orders;
drop policy if exists "room orders can be updated by app" on public.room_orders;
drop policy if exists "service orders app read" on public.service_orders;
drop policy if exists "service orders app insert" on public.service_orders;
drop policy if exists "service orders app update" on public.service_orders;
drop policy if exists "sales app insert" on public.sales;
drop policy if exists "sales app read" on public.sales;
drop policy if exists "pending payments app read" on public.pending_payments;
drop policy if exists "pending payments app insert" on public.pending_payments;
drop policy if exists "pending payments app update" on public.pending_payments;
drop policy if exists "app customers read" on public.app_customers;
drop policy if exists "app customers insert" on public.app_customers;
drop policy if exists "app customers update" on public.app_customers;
drop policy if exists "managers can manage app customers" on public.app_customers;
drop policy if exists "admins can manage app customers" on public.app_customers;
drop policy if exists "app orders read" on public.app_orders;
drop policy if exists "app orders insert" on public.app_orders;
drop policy if exists "app orders update" on public.app_orders;
drop policy if exists "fiscal requests read" on public.fiscal_requests;
drop policy if exists "fiscal requests write" on public.fiscal_requests;
drop policy if exists "support ai reviews read" on public.support_ai_reviews;
drop policy if exists "support ai reviews write" on public.support_ai_reviews;

-- Leitura publica minima para cardapio e almoco do dia.
create policy "public can read menu products"
on public.products
for select
to anon, authenticated
using (true);

create policy "public can read daily lunches"
on public.daily_lunches
for select
to anon, authenticated
using (true);

-- Pedido publico pode entrar, mas gestao fica restrita a usuario autenticado.
create policy "public can create room orders"
on public.room_orders
for insert
to anon, authenticated
with check (true);

create policy "operators can manage room orders"
on public.room_orders
for all
to authenticated
using (public.is_pdv_operator())
with check (public.is_pdv_operator());

create policy "operators can manage service orders"
on public.service_orders
for all
to authenticated
using (public.is_pdv_operator())
with check (public.is_pdv_operator());

create policy "operators can create sales"
on public.sales
for insert
to authenticated
with check (public.is_pdv_operator());

create policy "managers can read sales"
on public.sales
for select
to authenticated
using (public.is_pdv_manager());

create policy "operators can manage pending payments"
on public.pending_payments
for all
to authenticated
using (public.is_pdv_operator())
with check (public.is_pdv_operator());

create policy "managers can manage products"
on public.products
for all
to authenticated
using (public.is_pdv_manager())
with check (public.is_pdv_manager());

create policy "managers can manage daily lunches"
on public.daily_lunches
for all
to authenticated
using (public.is_pdv_manager())
with check (public.is_pdv_manager());

-- App de clientes: cadastro e pedido entram publicamente, gestao fica restrita.
create policy "public can create app customers"
on public.app_customers
for insert
to anon, authenticated
with check (true);

create policy "public can create app orders"
on public.app_orders
for insert
to anon, authenticated
with check (true);

create policy "admins can manage app customers"
on public.app_customers
for all
to authenticated
using (public.is_pdv_admin())
with check (public.is_pdv_admin());

create policy "operators can read app orders"
on public.app_orders
for select
to authenticated
using (public.is_pdv_operator());

create policy "operators can update app orders"
on public.app_orders
for update
to authenticated
using (public.is_pdv_operator())
with check (public.is_pdv_operator());

-- Fiscal e suporte tecnico nao ficam publicos.
create policy "managers can manage fiscal requests"
on public.fiscal_requests
for all
to authenticated
using (public.is_pdv_manager())
with check (public.is_pdv_manager());

create policy "support can manage support reviews"
on public.support_ai_reviews
for all
to authenticated
using (public.is_pdv_support())
with check (public.is_pdv_support());

-- Usuarios internos nao devem ser lidos diretamente pelo frontend.
revoke all on table public.pdv_users from anon, authenticated;
