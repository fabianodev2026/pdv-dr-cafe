-- Execute no Supabase SQL Editor.
-- Libera pedidos internos do tipo "comanda", usados para vendas diretas no caixa
-- sem vincular a uma mesa ou quarto.

alter table public.service_orders
  drop constraint if exists service_orders_source_type_check;

alter table public.service_orders
  add constraint service_orders_source_type_check
  check (source_type in ('mesa', 'quarto', 'comanda'));
