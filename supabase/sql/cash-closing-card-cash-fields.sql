-- Execute no Supabase SQL Editor antes de salvar fechamento com os novos campos.
-- Adiciona dinheiro do dia e separacao de cartao credito/debito.

alter table public.cash_closings
  add column if not exists cash_in_day numeric(10,2) not null default 0,
  add column if not exists credit_total numeric(10,2) not null default 0,
  add column if not exists debit_total numeric(10,2) not null default 0;

notify pgrst, 'reload schema';
