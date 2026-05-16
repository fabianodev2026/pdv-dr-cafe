-- Execute no Supabase SQL Editor.
-- Permite cadastrar nome + sobrenome no app de clientes.

alter table public.app_customers
  drop constraint if exists app_customers_name_length,
  add constraint app_customers_name_length
  check (name is null or char_length(name) <= 60) not valid;

create or replace function public.app_customer_register(
  p_name text,
  p_login text,
  p_password text,
  p_phone text,
  p_position text,
  p_email text
)
returns table (
  id bigint,
  login text,
  status text
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_name text := trim(p_name);
  v_login text := trim(p_login);
  v_password text := trim(p_password);
  v_phone text := trim(p_phone);
  v_position text := trim(p_position);
  v_email text := lower(trim(p_email));
  v_phone_accounts int := 0;
  v_customer_id bigint;
  v_token text;
  v_link text;
begin
  if v_name = '' or v_login = '' or v_password = '' or v_phone = '' or v_position = '' or v_email = '' then
    raise exception 'Preencha todos os campos do cadastro.';
  end if;

  if char_length(v_name) > 60 then
    raise exception 'Nome completo deve ter ate 60 caracteres.';
  end if;

  if char_length(v_login) > 20 then
    raise exception 'Login deve ter ate 20 caracteres.';
  end if;

  if char_length(v_password) > 20 then
    raise exception 'Senha deve ter ate 20 caracteres.';
  end if;

  if char_length(v_position) > 20 then
    raise exception 'Cargo deve ter ate 20 caracteres.';
  end if;

  if char_length(v_phone) > 15 then
    raise exception 'Telefone deve ter ate 15 caracteres.';
  end if;

  if char_length(v_email) > 120 then
    raise exception 'Email deve ter ate 120 caracteres.';
  end if;

  if exists (
    select 1
    from public.app_customers as c
    where c.login = v_login
  ) then
    raise exception 'Este login ja tem cadastro.';
  end if;

  if exists (
    select 1
    from public.app_customers as c
    where lower(c.email) = v_email
      and c.phone = v_phone
  ) then
    raise exception 'Este telefone ja possui cadastro com este email.';
  end if;

  select count(*)
  into v_phone_accounts
  from public.app_customers as c
  where c.phone = v_phone;

  if v_phone_accounts >= 3 then
    raise exception 'Este telefone ja atingiu o limite de 3 contas.';
  end if;

  insert into public.app_customers (
    name,
    login,
    password_hash,
    phone,
    position,
    email,
    email_verified,
    status,
    payment_day,
    credit_limit
  )
  values (
    v_name,
    v_login,
    crypt(v_password, gen_salt('bf', 10)),
    v_phone,
    v_position,
    v_email,
    false,
    'pendente',
    5,
    0
  )
  returning app_customers.id into v_customer_id;

  v_token := gen_random_uuid()::text || '-' || encode(gen_random_bytes(12), 'hex');
  v_link := public.app_build_customer_link('verify_email', v_token);

  insert into public.app_customer_email_verifications (
    customer_id,
    email,
    token_hash,
    expires_at
  )
  values (
    v_customer_id,
    v_email,
    encode(digest(v_token, 'sha256'), 'hex'),
    now() + interval '2 days'
  );

  insert into public.app_email_outbox (
    to_email,
    subject,
    text_body,
    html_body,
    metadata
  )
  values (
    v_email,
    'Confirme seu cadastro no Dr. Cafe',
    'Ola, confirme seu cadastro no Dr. Cafe acessando: ' || v_link,
    '<p>Ola,</p><p>Confirme seu cadastro no Dr. Cafe clicando no link abaixo:</p><p><a href="' || v_link || '">Confirmar email</a></p><p>Se voce nao fez esse cadastro, ignore esta mensagem.</p>',
    jsonb_build_object('kind', 'customer_email_verification', 'customer_id', v_customer_id)
  );

  return query
  select v_customer_id, v_login, 'pendente'::text;
end;
$$;

revoke all on function public.app_customer_register(text, text, text, text, text, text) from public;
grant execute on function public.app_customer_register(text, text, text, text, text, text) to anon;
grant execute on function public.app_customer_register(text, text, text, text, text, text) to authenticated;

notify pgrst, 'reload schema';
