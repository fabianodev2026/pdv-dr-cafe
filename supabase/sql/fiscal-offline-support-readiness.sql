-- Preparacao para CPF na Nota Fiscal Paulista, fila fiscal, offline e suporte IA.
-- Execute no Supabase SQL Editor quando for ligar essas funcoes ao banco.

alter table public.sales
  add column if not exists fiscal_cpf text,
  add column if not exists fiscal_status text not null default 'nao_emitida',
  add column if not exists fiscal_payload jsonb,
  add column if not exists fiscal_qr_code_url text,
  add column if not exists fiscal_qr_code_text text,
  add column if not exists fiscal_error text;

create table if not exists public.fiscal_requests (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  sale_id text,
  customer_cpf text,
  total_amount numeric(10,2) not null default 0,
  payment_method text,
  items jsonb not null default '[]'::jsonb,
  status text not null default 'pendente_certificado',
  qr_code_url text,
  qr_code_text text,
  protocol text,
  issued_at timestamptz,
  error_message text
);

alter table public.fiscal_requests enable row level security;

drop policy if exists "fiscal requests read" on public.fiscal_requests;
create policy "fiscal requests read"
on public.fiscal_requests
for select
to anon, authenticated
using (true);

drop policy if exists "fiscal requests write" on public.fiscal_requests;
create policy "fiscal requests write"
on public.fiscal_requests
for all
to anon, authenticated
using (true)
with check (true);

create table if not exists public.support_ai_reviews (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  title text not null,
  status text not null default 'aguardando_suporte_tecnico',
  summary text,
  logs jsonb not null default '[]'::jsonb,
  correction_notes text
);

alter table public.support_ai_reviews enable row level security;

drop policy if exists "support ai reviews read" on public.support_ai_reviews;
create policy "support ai reviews read"
on public.support_ai_reviews
for select
to anon, authenticated
using (true);

drop policy if exists "support ai reviews write" on public.support_ai_reviews;
create policy "support ai reviews write"
on public.support_ai_reviews
for all
to anon, authenticated
using (true)
with check (true);
