-- Execute no Supabase SQL Editor antes da inauguracao.
-- Apaga somente movimentos/testes de venda para iniciar a loja limpa.
-- Mantem produtos, clientes, usuarios, configuracoes, almocos e cardapio.

do $$
declare
  target_table text;
begin
  foreach target_table in array array[
    'nfce_issues',
    'fiscal_requests',
    'cash_closings',
    'app_orders',
    'service_orders',
    'room_orders',
    'pending_payments',
    'sales'
  ]
  loop
    if to_regclass('public.' || target_table) is not null then
      execute format(
        'truncate table public.%I restart identity cascade',
        target_table
      );
    end if;
  end loop;
end;
$$;

notify pgrst, 'reload schema';

-- Conferencia rapida depois de executar:
-- select count(*) as vendas from public.sales;
-- select count(*) as pagar_depois from public.pending_payments;
-- select count(*) as pedidos_mesa_quarto from public.service_orders;
-- select count(*) as pedidos_quarto_app from public.room_orders;
-- select count(*) as pedidos_cliente_app from public.app_orders;
-- select count(*) as fechamentos from public.cash_closings;
