-- Execute no Supabase SQL Editor.
-- Cria a tabela de abertura e fechamento diario de caixa.

create table if not exists public.cash_closings (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  closing_date date not null,
  opening_cashier_name text,
  cashier_name text,
  opening_cash numeric(10,2) not null default 0,
  cash_in_day numeric(10,2) not null default 0,
  counted_cash numeric(10,2) not null default 0,
  card_total numeric(10,2) not null default 0,
  credit_total numeric(10,2) not null default 0,
  debit_total numeric(10,2) not null default 0,
  pix_total numeric(10,2) not null default 0,
  grand_total numeric(10,2) not null default 0,
  cash_difference numeric(10,2) not null default 0,
  notes_detail jsonb not null default '{}'::jsonb,
  coins_detail jsonb not null default '{}'::jsonb
);

alter table public.cash_closings
  add column if not exists opening_cashier_name text,
  add column if not exists cash_in_day numeric(10,2) not null default 0,
  add column if not exists credit_total numeric(10,2) not null default 0,
  add column if not exists debit_total numeric(10,2) not null default 0;

alter table public.cash_closings enable row level security;

drop policy if exists "cash closings app read" on public.cash_closings;
create policy "cash closings app read"
on public.cash_closings
for select
to anon, authenticated
using (true);

drop policy if exists "cash closings app insert" on public.cash_closings;
create policy "cash closings app insert"
on public.cash_closings
for insert
to anon, authenticated
with check (true);

drop policy if exists "cash closings app update" on public.cash_closings;
create policy "cash closings app update"
on public.cash_closings
for update
to anon, authenticated
using (true)
with check (true);

create index if not exists cash_closings_closing_date_idx
on public.cash_closings (closing_date desc);

create unique index if not exists cash_closings_closing_date_key
on public.cash_closings (closing_date);

notify pgrst, 'reload schema';
