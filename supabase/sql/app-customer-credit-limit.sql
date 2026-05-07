-- Limite de credito do app de clientes.
-- Execute no Supabase SQL Editor para liberar limite ajustavel pelo admin.

alter table public.app_customers
  add column if not exists credit_limit numeric(10,2) not null default 0;

alter table public.app_customers
  drop constraint if exists app_customers_credit_limit_positive,
  add constraint app_customers_credit_limit_positive
  check (credit_limit >= 0) not valid;
