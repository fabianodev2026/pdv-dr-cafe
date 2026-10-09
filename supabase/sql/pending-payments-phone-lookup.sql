-- Consulta do saldo devedor por telefone, sem depender do formato digitado.
-- Rode no Supabase SQL Editor.
--
-- Problema que isto resolve: o telefone e gravado com mascara no cadastro do
-- app e solto no caixa. A consulta antiga comparava texto com texto, entao a
-- pendencia existia mas nao aparecia para o cliente.
--
-- Ganho de seguranca: com esta funcao o app pede ao banco apenas as linhas do
-- proprio telefone. Sem ela o app precisa filtrar no aparelho, ou seja, linhas
-- de outros numeros parecidos chegam ao navegador antes do filtro.
--
-- O app funciona com ou sem este arquivo aplicado: se a funcao nao existir,
-- ele volta sozinho para a consulta por padrao de texto.

-- 1) Telefone comparavel: so digitos, sem o codigo do pais.
create or replace function public.phone_digits(p_phone text)
returns text
language sql
immutable
set search_path = public, extensions
as $$
  select case
           when length(limpo.digits) >= 12 and left(limpo.digits, 2) = '55'
             then substr(limpo.digits, 3)
           else limpo.digits
         end
  from (
    select regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g') as digits
  ) as limpo;
$$;

-- 2) Indice para a busca normalizada nao varrer a tabela inteira.
create index if not exists pending_payments_phone_digits_idx
  on public.pending_payments (public.phone_digits(phone));

-- 3) Saldo em aberto de um telefone, com o filtro feito no banco.
--    Exige 10 digitos para nao devolver nada com telefone incompleto.
create or replace function public.get_pending_by_phone(p_phone text)
returns setof public.pending_payments
language sql
security definer
stable
set search_path = public, extensions
as $$
  select p.*
  from public.pending_payments as p
  where p.status = 'pendente'
    and length(public.phone_digits(p_phone)) >= 10
    and public.phone_digits(p.phone) = public.phone_digits(p_phone);
$$;

revoke all on function public.get_pending_by_phone(text) from public;
grant execute on function public.get_pending_by_phone(text) to anon, authenticated;

-- Conferencia rapida, troque pelo telefone de um cliente que deve:
--   select * from public.get_pending_by_phone('(11) 99999-8888');
--   select * from public.get_pending_by_phone('11999998888');
-- As duas chamadas precisam devolver as mesmas linhas.

-- Quantas linhas ficariam agrupadas de forma diferente da comparacao por texto
-- (util para achar telefone digitado torto no caixa):
--   select public.phone_digits(phone) as digitos,
--          count(distinct phone) as formatos,
--          array_agg(distinct phone) as como_foi_digitado
--   from public.pending_payments
--   group by 1
--   having count(distinct phone) > 1;

-- PENDENTE DE DECISAO SUA, nao aplicado aqui:
-- hoje a chave anon le a tabela pending_payments direto, porque o PDV no
-- navegador usa essa mesma chave. Enquanto for assim, esta funcao reduz o que
-- o app do cliente recebe, mas nao impede alguem de consultar a tabela com a
-- chave publica. O fechamento completo exige o PDV autenticar com usuario
-- Supabase e depois:
--   alter table public.pending_payments enable row level security;
--   revoke all on table public.pending_payments from anon;
--   -- + policies para o papel do PDV
-- Nao rode essas tres linhas antes de migrar o login do PDV: elas derrubam o
-- caixa na hora.
