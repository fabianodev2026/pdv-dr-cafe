-- Ajustes de 10/05/2026:
-- - Email do app ate 35 caracteres.
-- - Mesmo telefone pode ter ate 3 contas, desde que o email seja diferente.
-- - Cadastro gera link de verificacao de email.
-- - Esqueci a senha gera link seguro para trocar senha por email.
-- - Exclusao de cliente do app limpa pedidos e tokens antes de excluir.
-- - Acesso da aba Suporte validado por senha no banco.
--
-- Importante:
-- Este SQL cria a fila app_email_outbox. Para enviar email de verdade, publique a
-- funcao Supabase Edge em supabase/functions/send-app-emails e configure RESEND_API_KEY.

create extension if not exists pgcrypto;

alter table public.app_customers
  add column if not exists email_verified boolean not null default false;

alter table public.app_customers
  drop constraint if exists app_customers_email_length,
  add constraint app_customers_email_length check (char_length(email) <= 35) not valid;

alter table public.app_customers
  drop constraint if exists app_customers_phone_key;

drop index if exists public.app_customers_phone_key;

create index if not exists app_customers_phone_idx
on public.app_customers (phone);

create table if not exists public.app_email_outbox (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  to_email text not null,
  subject text not null,
  text_body text not null,
  html_body text not null,
  status text not null default 'pendente',
  error_message text,
  provider_message_id text,
  metadata jsonb not null default '{}'::jsonb
);

alter table public.app_email_outbox
  drop constraint if exists app_email_outbox_status_check,
  add constraint app_email_outbox_status_check
  check (status in ('pendente', 'enviado', 'erro')) not valid;

create index if not exists app_email_outbox_status_created_idx
on public.app_email_outbox (status, created_at);

alter table public.app_email_outbox enable row level security;

create table if not exists public.app_customer_email_verifications (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  customer_id bigint not null references public.app_customers(id) on delete cascade,
  email text not null,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  status text not null default 'novo'
);

alter table public.app_customer_email_verifications
  drop constraint if exists app_customer_email_verifications_status_check,
  add constraint app_customer_email_verifications_status_check
  check (status in ('novo', 'usado', 'expirado')) not valid;

alter table public.app_customer_email_verifications enable row level security;

create table if not exists public.app_customer_password_reset_tokens (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  customer_id bigint not null references public.app_customers(id) on delete cascade,
  email text not null,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  status text not null default 'novo'
);

alter table public.app_customer_password_reset_tokens
  drop constraint if exists app_customer_password_reset_tokens_status_check,
  add constraint app_customer_password_reset_tokens_status_check
  check (status in ('novo', 'usado', 'expirado')) not valid;

alter table public.app_customer_password_reset_tokens enable row level security;

create or replace function public.app_build_customer_link(
  p_param_name text,
  p_token text
)
returns text
language sql
stable
as $$
  select 'https://pdv-dr-cafe.vercel.app/app?' || p_param_name || '=' || p_token;
$$;

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

  if char_length(v_name) > 25 then
    raise exception 'Nome deve ter ate 25 caracteres.';
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

  if char_length(v_email) > 35 then
    raise exception 'Email deve ter ate 35 caracteres.';
  end if;

  if exists (
    select 1
    from public.app_customers as c
    where c.phone = v_phone
      and lower(c.email) = v_email
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

create or replace function public.app_customer_verify_email(
  p_token text
)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_token_hash text := encode(digest(trim(p_token), 'sha256'), 'hex');
  v_customer_id bigint;
begin
  select v.customer_id
  into v_customer_id
  from public.app_customer_email_verifications as v
  where v.token_hash = v_token_hash
    and v.used_at is null
    and v.expires_at > now()
    and v.status = 'novo'
  limit 1;

  if v_customer_id is null then
    return false;
  end if;

  update public.app_customer_email_verifications
  set used_at = now(),
      status = 'usado'
  where token_hash = v_token_hash;

  update public.app_customers
  set email_verified = true
  where id = v_customer_id;

  return true;
end;
$$;

revoke all on function public.app_customer_verify_email(text) from public;
grant execute on function public.app_customer_verify_email(text) to anon;
grant execute on function public.app_customer_verify_email(text) to authenticated;

create or replace function public.app_customer_request_password_reset(
  p_login text,
  p_email text
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_login text := trim(p_login);
  v_email text := lower(trim(p_email));
  v_customer_id bigint;
  v_token text;
  v_link text;
begin
  if v_login = '' or v_email = '' then
    raise exception 'Preencha login e email cadastrado.';
  end if;

  if char_length(v_login) > 20 then
    raise exception 'Login deve ter ate 20 caracteres.';
  end if;

  if char_length(v_email) > 35 then
    raise exception 'Email deve ter ate 35 caracteres.';
  end if;

  select c.id
  into v_customer_id
  from public.app_customers as c
  where c.login = v_login
    and lower(c.email) = v_email
  limit 1;

  if v_customer_id is not null then
    insert into public.app_customer_password_reset_requests (
      customer_id,
      login,
      email,
      status
    )
    values (
      v_customer_id,
      v_login,
      v_email,
      'novo'
    );

    v_token := gen_random_uuid()::text || '-' || encode(gen_random_bytes(12), 'hex');
    v_link := public.app_build_customer_link('reset_password', v_token);

    insert into public.app_customer_password_reset_tokens (
      customer_id,
      email,
      token_hash,
      expires_at
    )
    values (
      v_customer_id,
      v_email,
      encode(digest(v_token, 'sha256'), 'hex'),
      now() + interval '1 hour'
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
      'Recuperacao de senha Dr. Cafe',
      'Para trocar sua senha do app Dr. Cafe, acesse: ' || v_link,
      '<p>Recebemos uma solicitacao para trocar sua senha do app Dr. Cafe.</p><p><a href="' || v_link || '">Criar nova senha</a></p><p>Este link vence em 1 hora. Se voce nao solicitou, ignore esta mensagem.</p>',
      jsonb_build_object('kind', 'customer_password_reset', 'customer_id', v_customer_id)
    );
  end if;
end;
$$;

revoke all on function public.app_customer_request_password_reset(text, text) from public;
grant execute on function public.app_customer_request_password_reset(text, text) to anon;
grant execute on function public.app_customer_request_password_reset(text, text) to authenticated;

create or replace function public.app_customer_reset_password_with_token(
  p_token text,
  p_new_password text
)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_token_hash text := encode(digest(trim(p_token), 'sha256'), 'hex');
  v_password text := trim(p_new_password);
  v_customer_id bigint;
begin
  if v_password = '' or char_length(v_password) > 20 then
    raise exception 'Senha deve ter ate 20 caracteres.';
  end if;

  select t.customer_id
  into v_customer_id
  from public.app_customer_password_reset_tokens as t
  where t.token_hash = v_token_hash
    and t.used_at is null
    and t.expires_at > now()
    and t.status = 'novo'
  limit 1;

  if v_customer_id is null then
    return false;
  end if;

  update public.app_customers
  set password_hash = crypt(v_password, gen_salt('bf', 10))
  where id = v_customer_id;

  update public.app_customer_password_reset_tokens
  set used_at = now(),
      status = 'usado'
  where token_hash = v_token_hash;

  update public.app_customer_password_reset_requests
  set status = 'concluido'
  where customer_id = v_customer_id
    and status = 'novo';

  return true;
end;
$$;

revoke all on function public.app_customer_reset_password_with_token(text, text) from public;
grant execute on function public.app_customer_reset_password_with_token(text, text) to anon;
grant execute on function public.app_customer_reset_password_with_token(text, text) to authenticated;

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

  delete from public.app_customer_password_reset_requests
  where customer_id = p_customer_id;

  delete from public.app_customer_password_reset_tokens
  where customer_id = p_customer_id;

  delete from public.app_customer_email_verifications
  where customer_id = p_customer_id;

  delete from public.app_customers
  where id = p_customer_id;
end;
$$;

revoke all on function public.admin_delete_app_customer(text, text, bigint) from public;
grant execute on function public.admin_delete_app_customer(text, text, bigint) to anon;
grant execute on function public.admin_delete_app_customer(text, text, bigint) to authenticated;

create or replace function public.verify_pdv_support_access(
  p_password text
)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  return exists (
    select 1
    from public.pdv_users as u
    where u.role in ('admin', 'suporte_tecnico')
      and u.password_hash is not null
      and crypt(p_password, u.password_hash) = u.password_hash
  );
end;
$$;

revoke all on function public.verify_pdv_support_access(text) from public;
grant execute on function public.verify_pdv_support_access(text) to anon;
grant execute on function public.verify_pdv_support_access(text) to authenticated;

notify pgrst, 'reload schema';
