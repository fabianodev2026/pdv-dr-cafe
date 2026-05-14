-- Permite ao cliente recuperar o login usando telefone e email cadastrados.
-- Execute no Supabase SQL Editor.

create or replace function public.app_customer_find_login(
  p_phone text,
  p_email text
)
returns table (
  login text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_phone text := trim(p_phone);
  v_email text := lower(trim(p_email));
begin
  if v_phone = '' or v_email = '' then
    raise exception 'Preencha telefone e email cadastrado.';
  end if;

  return query
  select c.login
  from public.app_customers as c
  where c.phone = v_phone
    and lower(c.email) = v_email
  order by c.created_at desc
  limit 1;
end;
$$;

revoke all on function public.app_customer_find_login(text, text) from public;
grant execute on function public.app_customer_find_login(text, text) to anon;
grant execute on function public.app_customer_find_login(text, text) to authenticated;

notify pgrst, 'reload schema';
