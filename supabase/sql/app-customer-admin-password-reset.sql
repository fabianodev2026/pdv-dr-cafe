-- Permite ao admin resetar senha de cliente app e ao cliente trocar a senha.
-- Execute no Supabase SQL Editor antes de usar os botoes novos.

create extension if not exists pgcrypto;

create or replace function public.admin_reset_app_customer_password(
  p_admin_username text,
  p_admin_password text,
  p_customer_id bigint,
  p_new_password text
)
returns table (
  id bigint,
  name text,
  login text
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_password text := trim(p_new_password);
begin
  perform public.ensure_pdv_admin(p_admin_username, p_admin_password);

  if v_password = '' or char_length(v_password) > 20 then
    raise exception 'Senha provisoria deve ter ate 20 caracteres.';
  end if;

  return query
  update public.app_customers as c
  set password_hash = crypt(v_password, gen_salt('bf', 10))
  where c.id = p_customer_id
  returning c.id, c.name, c.login;
end;
$$;

revoke all on function public.admin_reset_app_customer_password(text, text, bigint, text) from public;
grant execute on function public.admin_reset_app_customer_password(text, text, bigint, text) to anon;
grant execute on function public.admin_reset_app_customer_password(text, text, bigint, text) to authenticated;

create or replace function public.app_customer_change_password(
  p_login text,
  p_current_password text,
  p_new_password text
)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_login text := trim(p_login);
  v_current_password text := trim(p_current_password);
  v_new_password text := trim(p_new_password);
  v_customer_id bigint;
begin
  if v_login = '' or v_current_password = '' or v_new_password = '' then
    raise exception 'Preencha senha atual e nova senha.';
  end if;

  if char_length(v_new_password) > 20 then
    raise exception 'Nova senha deve ter ate 20 caracteres.';
  end if;

  select c.id
  into v_customer_id
  from public.app_customers as c
  where c.login = v_login
    and c.password_hash is not null
    and crypt(v_current_password, c.password_hash) = c.password_hash
  limit 1;

  if v_customer_id is null then
    return false;
  end if;

  update public.app_customers
  set password_hash = crypt(v_new_password, gen_salt('bf', 10))
  where id = v_customer_id;

  return true;
end;
$$;

revoke all on function public.app_customer_change_password(text, text, text) from public;
grant execute on function public.app_customer_change_password(text, text, text) to anon;
grant execute on function public.app_customer_change_password(text, text, text) to authenticated;

notify pgrst, 'reload schema';
