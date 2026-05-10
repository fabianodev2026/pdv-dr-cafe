-- Modelo para cadastrar produtos com codigo de barras.
-- Execute no Supabase SQL Editor.

alter table public.products
  add column if not exists barcode text;

insert into public.products (
  name,
  unit_price,
  category,
  description,
  image_url,
  barcode,
  stock_quantity,
  low_stock_threshold
)
values
  ('Nome do Produto', 10.00, 'comida', 'Descricao curta', '', '7890000000000', 0, 0),
  ('Nome da Bebida', 7.50, 'bebida', 'Descricao curta', '', '7890000000001', 0, 0),
  ('Nome do Presente', 19.90, 'presente', 'Lembrancinha', '', '7890000000002', 0, 0);

notify pgrst, 'reload schema';
