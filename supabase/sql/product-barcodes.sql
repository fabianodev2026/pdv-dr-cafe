-- Execute no Supabase SQL Editor.
-- Adiciona codigo de barras opcional no cadastro de produtos.

alter table public.products
  add column if not exists barcode text;

create index if not exists products_barcode_idx
on public.products (barcode)
where barcode is not null and barcode <> '';
