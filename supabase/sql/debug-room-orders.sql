-- Rode no Supabase SQL Editor para testar pedidos de quartos.

select to_regclass('public.room_orders') as room_orders_existe;

select column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name = 'room_orders'
order by ordinal_position;

insert into public.room_orders (
  room_number,
  patient_name,
  phone,
  items,
  total_amount,
  status,
  customer_message
)
values (
  101,
  'Teste Paciente',
  '11999999999',
  '[{"name":"Teste","quantity":1,"unit_price":1.00}]'::jsonb,
  1.00,
  'novo',
  'Pedido teste enviado.'
);

select id, created_at, room_number, patient_name, phone, status, total_amount
from public.room_orders
order by created_at desc
limit 5;
