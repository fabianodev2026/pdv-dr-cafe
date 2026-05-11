-- Execute no Supabase SQL Editor para recuperar o relatorio diario de hoje.
-- Ele copia para public.sales as compras de cliente app/pagar depois lancadas hoje
-- em public.pending_payments, sem duplicar registros que ja existam em sales.

insert into public.sales (
  created_at,
  table_number,
  total_amount,
  cashier_name,
  customer_name,
  customer_phone,
  items,
  payment_method
)
select
  pp.created_at,
  null,
  pp.total_amount,
  'PDV',
  pp.customer_name,
  pp.phone,
  jsonb_build_array(
    jsonb_build_object(
      'name', coalesce(nullif(pp.items_detail, ''), pp.description, 'Compra cliente app'),
      'quantity', 1,
      'unit_price', pp.total_amount,
      'total', pp.total_amount
    )
  ),
  'cliente_app'
from public.pending_payments pp
where pp.purchase_date = current_date
  and not exists (
    select 1
    from public.sales s
    where s.created_at = pp.created_at
      and s.total_amount = pp.total_amount
      and coalesce(s.customer_phone, '') = coalesce(pp.phone, '')
      and s.payment_method = 'cliente_app'
  );
