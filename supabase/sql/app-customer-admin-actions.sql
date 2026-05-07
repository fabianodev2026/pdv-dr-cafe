-- Funcoes administrativas para clientes do app.
-- Execute no Supabase SQL Editor para permitir que somente admin geral
-- altere limite ou exclua conta gerada pelo app.

create extension if not exists pgcrypto;

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
    where u.username = trim(p_admin_username)
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

create or replace function public.admin_delete_app_customer(
  p_admin_username text,
  p_admin_password text,
  p_customer_id bigint
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  perform public.ensure_pdv_admin(p_admin_username, p_admin_password);

  update public.app_orders
  set customer_id = null
  where customer_id = p_customer_id;

  delete from public.app_customers
  where id = p_customer_id;
end;
$$;

revoke all on function public.admin_delete_app_customer(text, text, bigint) from public;
grant execute on function public.admin_delete_app_customer(text, text, bigint) to anon;
grant execute on function public.admin_delete_app_customer(text, text, bigint) to authenticated;

notify pgrst, 'reload schema';
