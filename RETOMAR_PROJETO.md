# Retomar Projeto - PDV Dr. Cafe

## Projeto salvo

Pasta local:

```txt
C:\Users\ADM\Documents\Codex\2026-05-10\puxar-o-git-do-dr-cafe\pdv-dr-cafe
```

Repositorio GitHub:

```txt
https://github.com/fabianodev2026/pdv-dr-cafe.git
```

Branch:

```txt
main
```

Ultimo commit enviado:

```txt
05cd478 Add item shortcut for table and room orders
```

## O que ficou implementado

- Aba lateral `PDV` mantida com o nome original.
- Nova aba lateral `Comandas`.
- Comandas para pedidos fora de mesa/quarto, direto no caixa ou por telefone.
- Campo de nome e telefone para comandas.
- Separacao de produtos por `Todos`, `Bebidas`, `Comidas` e `Presentes`.
- Categoria nova `presente` para lembrancinhas.
- Cadastro de produtos com `Codigo de barras`.
- Busca de produtos no PDV tambem pelo codigo de barras.
- SQL modelo para cadastrar produtos em lote.
- Botao `Adicionar itens` na tela `Ultimos pedidos feitos` para comanda, mesa e quarto.
- Ao adicionar itens depois de enviar pedido, os itens antigos ficam como `Enviado` e so o acrescimo novo e enviado.
- Arredondamento de valores do app cliente para salvar em centavos corretamente.
- Aba `Fechamento` abaixo de `Configuracoes`, com nome de quem abriu o caixa, abertura em dinheiro, contagem por notas/moedas, cartao, Pix, total automatico, impressao e opcao de salvar em PDF pela janela de impressao.

## SQLs novos/importantes

Executar no Supabase SQL Editor quando necessario:

```txt
supabase/sql/product-barcodes.sql
supabase/sql/product-insert-template.sql
supabase/sql/service-orders-comandas.sql
supabase/sql/cash-closing.sql
supabase/sql/fix-pdv-users-password-hash.sql
supabase/sql/reset-test-movements-before-opening.sql
```

Para liberar codigo de barras:

```sql
alter table public.products
  add column if not exists barcode text;

create index if not exists products_barcode_idx
on public.products (barcode)
where barcode is not null and barcode <> '';

notify pgrst, 'reload schema';
```

Para liberar pedidos do tipo comanda:

```sql
alter table public.service_orders
  drop constraint if exists service_orders_source_type_check;

alter table public.service_orders
  add constraint service_orders_source_type_check
  check (source_type in ('mesa', 'quarto', 'comanda'));

notify pgrst, 'reload schema';
```

Para liberar fechamento diario de caixa:

```txt
supabase/sql/cash-closing.sql
```

## Validacoes feitas

```txt
npm.cmd run build
```

Build passou. O Vite mostrou apenas aviso de bundle acima de 500 kB, sem quebrar a compilacao.

## Observacoes para continuar

- Se o Supabase reclamar que `barcode` nao existe, rodar `supabase/sql/product-barcodes.sql`.
- Se a comanda nao enviar para `Ultimos pedidos feitos`, rodar `supabase/sql/service-orders-comandas.sql`.
- Se o fechamento nao salvar, rodar `supabase/sql/cash-closing.sql`.
- Se salvar saldo/limite do cliente app mostrar `column u.password_hash does not exist`, rodar `supabase/sql/fix-pdv-users-password-hash.sql`.
- Para zerar vendas/testes antes da inauguracao mantendo cadastros, rodar `supabase/sql/reset-test-movements-before-opening.sql`.
- O leitor de codigo de barras comum USB/Bluetooth deve funcionar como teclado, sem instalar nada.
