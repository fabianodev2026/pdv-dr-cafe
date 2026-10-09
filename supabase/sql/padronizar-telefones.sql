-- Padroniza os telefones ja gravados no formato (DD) 99999-8888.
--
-- Numero de 11 digitos sai com 5 digitos antes do traco e 4 depois.
-- Numero de 10 digitos (fixo) sai como (DD) 9999-8888.
-- Qualquer outra quantidade de digitos NAO e tocada: ramal, telefone
-- incompleto ou numero internacional ficam como estao e aparecem na
-- conferencia do bloco 4, para voce decidir um a um. O script nunca inventa
-- o nono digito.
--
-- Rode os blocos na ordem, conferindo o resultado de cada um.
-- O script e idempotente: rodar de novo nao muda nada.

-- ============================================================
-- BLOCO 1 - funcoes de apoio (pode rodar sempre)
-- ============================================================

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

create or replace function public.phone_format_br(p_phone text)
returns text
language sql
immutable
set search_path = public, extensions
as $$
  select case
           when length(d.digits) = 11
             then '(' || substr(d.digits, 1, 2) || ') ' ||
                  substr(d.digits, 3, 5) || '-' || substr(d.digits, 8, 4)
           when length(d.digits) = 10
             then '(' || substr(d.digits, 1, 2) || ') ' ||
                  substr(d.digits, 3, 4) || '-' || substr(d.digits, 7, 4)
           else p_phone
         end
  from (select public.phone_digits(p_phone) as digits) as d;
$$;

-- ============================================================
-- BLOCO 2 - PREVIA: o que mudaria, sem alterar nada
-- Rode e confira antes de seguir para o bloco 3.
-- ============================================================

select 'pending_payments' as tabela, phone as antes,
       public.phone_format_br(phone) as depois, count(*) as linhas
from public.pending_payments
where phone is not null
  and phone is distinct from public.phone_format_br(phone)
group by 1, 2, 3
union all
select 'app_customers', phone, public.phone_format_br(phone), count(*)
from public.app_customers
where phone is not null
  and phone is distinct from public.phone_format_br(phone)
group by 1, 2, 3
union all
select 'pdv_customers', phone, public.phone_format_br(phone), count(*)
from public.pdv_customers
where phone is not null
  and phone is distinct from public.phone_format_br(phone)
group by 1, 2, 3
order by 1, 2;

-- ============================================================
-- BLOCO 3 - aplica a padronizacao
-- Guarda o valor antigo antes, para dar para voltar atras.
-- ============================================================

create table if not exists public.backup_telefones_padronizacao (
  id bigserial primary key,
  executado_em timestamptz not null default now(),
  tabela text not null,
  registro_id bigint not null,
  phone_antes text
);

insert into public.backup_telefones_padronizacao (tabela, registro_id, phone_antes)
select 'pending_payments', p.id, p.phone
from public.pending_payments as p
where p.phone is not null
  and p.phone is distinct from public.phone_format_br(p.phone);

update public.pending_payments as p
set phone = public.phone_format_br(p.phone)
where p.phone is not null
  and p.phone is distinct from public.phone_format_br(p.phone);

insert into public.backup_telefones_padronizacao (tabela, registro_id, phone_antes)
select 'app_customers', c.id, c.phone
from public.app_customers as c
where c.phone is not null
  and c.phone is distinct from public.phone_format_br(c.phone);

update public.app_customers as c
set phone = public.phone_format_br(c.phone)
where c.phone is not null
  and c.phone is distinct from public.phone_format_br(c.phone);

insert into public.backup_telefones_padronizacao (tabela, registro_id, phone_antes)
select 'pdv_customers', c.id, c.phone
from public.pdv_customers as c
where c.phone is not null
  and c.phone is distinct from public.phone_format_br(c.phone);

update public.pdv_customers as c
set phone = public.phone_format_br(c.phone)
where c.phone is not null
  and c.phone is distinct from public.phone_format_br(c.phone);

-- ============================================================
-- BLOCO 4 - conferencia
-- ============================================================

-- a) Deve voltar vazio: nada fora do padrao com 10 ou 11 digitos.
select 'pending_payments' as tabela, phone
from public.pending_payments
where phone is not null
  and length(public.phone_digits(phone)) in (10, 11)
  and phone is distinct from public.phone_format_br(phone)
union all
select 'app_customers', phone
from public.app_customers
where phone is not null
  and length(public.phone_digits(phone)) in (10, 11)
  and phone is distinct from public.phone_format_br(phone)
union all
select 'pdv_customers', phone
from public.pdv_customers
where phone is not null
  and length(public.phone_digits(phone)) in (10, 11)
  and phone is distinct from public.phone_format_br(phone);

-- b) O que o script deixou de proposito, para conferencia manual:
--    telefone incompleto, ramal, numero estrangeiro.
select 'pending_payments' as tabela, phone,
       length(public.phone_digits(phone)) as digitos
from public.pending_payments
where phone is not null
  and length(public.phone_digits(phone)) not in (10, 11)
union all
select 'app_customers', phone, length(public.phone_digits(phone))
from public.app_customers
where phone is not null
  and length(public.phone_digits(phone)) not in (10, 11)
union all
select 'pdv_customers', phone, length(public.phone_digits(phone))
from public.pdv_customers
where phone is not null
  and length(public.phone_digits(phone)) not in (10, 11)
order by 3, 1, 2;

-- ============================================================
-- COMO VOLTAR ATRAS, se precisar
-- ============================================================
-- update public.pending_payments as p
-- set phone = b.phone_antes
-- from public.backup_telefones_padronizacao as b
-- where b.tabela = 'pending_payments' and b.registro_id = p.id;
--
-- Troque o nome da tabela para app_customers ou pdv_customers conforme o caso.
-- Com mais de uma execucao gravada, filtre tambem por b.executado_em.
