-- Controle de estoque baixo dos produtos Dr. Cafe.
-- Rode no Supabase SQL Editor antes de salvar estoque pela tela Produtos.

alter table public.products
  add column if not exists stock_quantity integer not null default 0,
  add column if not exists low_stock_threshold integer not null default 0;

alter table public.products
  drop constraint if exists products_stock_quantity_non_negative,
  add constraint products_stock_quantity_non_negative
  check (stock_quantity >= 0) not valid;

alter table public.products
  drop constraint if exists products_low_stock_threshold_non_negative,
  add constraint products_low_stock_threshold_non_negative
  check (low_stock_threshold >= 0) not valid;

comment on column public.products.stock_quantity is
  'Quantidade atual em estoque informada pelo administrador.';

comment on column public.products.low_stock_threshold is
  'Quando o estoque for igual ou menor que este valor, o PDV mostra aviso de estoque baixo. Use 0 para desativar aviso.';
