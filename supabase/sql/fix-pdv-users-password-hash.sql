-- Execute no Supabase SQL Editor.
-- Corrige o erro: column u.password_hash does not exist
-- Necessario para salvar saldo/limite dos clientes do app.

create extension if not exists pgcrypto;

create table if not exists public.pdv_users (
  id bigserial primary key,
  username text not null unique,
  password_hash text,
  role text not null default 'caixa',
  created_at timestamptz not null default now()
);

alter table public.pdv_users
  add column if not exists username text,
  add column if not exists password_hash text,
  add column if not exists role text default 'caixa',
  add column if not exists created_at timestamptz default now();

create unique index if not exists pdv_users_username_key
on public.pdv_users (username);

alter table public.pdv_users enable row level security;

-- Se a tabela antiga tinha coluna "password" em texto puro, gera o hash.
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'pdv_users'
      and column_name = 'password'
  ) then
    execute $sql$
      update public.pdv_users
      set password_hash = crypt(password, gen_salt('bf', 10))
      where password_hash is null
        and password is not null
        and password <> ''
    $sql$;
  end if;
end;
$$;

create or replace function public.ensure_pdv_admin(
  p_admin_username text,
  p_admin_password text
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if not exists (
    select 1
    from public.pdv_users as u
    where lower(u.username) = lower(trim(p_admin_username))
      and u.role = 'admin'
      and u.password_hash is not null
      and crypt(p_admin_password, u.password_hash) = u.password_hash
  ) then
    raise exception 'Administrador nao autorizado.';
  end if;
end;
$$;

revoke all on function public.ensure_pdv_admin(text, text) from public;

create or replace function public.admin_update_app_customer_credit_limit(
  p_admin_username text,
  p_admin_password text,
  p_customer_id bigint,
  p_credit_limit numeric
)
returns table (
  id bigint,
  name text,
  credit_limit numeric
)
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  perform public.ensure_pdv_admin(p_admin_username, p_admin_password);

  if p_credit_limit < 0 then
    raise exception 'Limite nao pode ser negativo.';
  end if;

  return query
  update public.app_customers as c
  set credit_limit = p_credit_limit
  where c.id = p_customer_id
  returning c.id, c.name, c.credit_limit;
end;
$$;

revoke all on function public.admin_update_app_customer_credit_limit(text, text, bigint, numeric) from public;
grant execute on function public.admin_update_app_customer_credit_limit(text, text, bigint, numeric) to anon;
grant execute on function public.admin_update_app_customer_credit_limit(text, text, bigint, numeric) to authenticated;

-- Se ainda nao existir admin com senha bcrypt, cria/reseta admin padrao.
-- Senha temporaria para admin sem hash: admin123
insert into public.pdv_users (username, password_hash, role)
values ('admin', crypt('admin123', gen_salt('bf', 10)), 'admin')
on conflict (username) do update
set password_hash = coalesce(public.pdv_users.password_hash, excluded.password_hash),
    role = 'admin';

notify pgrst, 'reload schema';
