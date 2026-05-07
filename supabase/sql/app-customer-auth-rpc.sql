-- Cadastro e login seguros para o app de clientes Dr. Cafe.
-- Rode no Supabase SQL Editor quando o cadastro/login do app falhar.
-- Este arquivo evita expor a tabela app_customers e o password_hash ao frontend.

create extension if not exists pgcrypto;

alter table public.app_customers
  add column if not exists login text,
  add column if not exists password_hash text,
  add column if not exists status text not null default 'pendente',
  add column if not exists payment_day int not null default 5,
  add column if not exists credit_limit numeric(10,2) not null default 0;

create table if not exists public.app_customer_password_reset_requests (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  customer_id bigint references public.app_customers(id) on delete set null,
  login text not null,
  email text not null,
  status text not null default 'novo'
);

alter table public.app_customer_password_reset_requests enable row level security;
revoke all on table public.app_customer_password_reset_requests from anon, authenticated;

alter table public.app_customers
  drop constraint if exists app_customers_name_length,
  add constraint app_customers_name_length check (char_length(name) <= 25) not valid;

alter table public.app_customers
  drop constraint if exists app_customers_login_length,
  add constraint app_customers_login_length check (char_length(login) <= 20) not valid;

alter table public.app_customers
  drop constraint if exists app_customers_position_length,
  add constraint app_customers_position_length check (char_length(position) <= 20) not valid;

alter table public.app_customers
  drop constraint if exists app_customers_phone_length,
  add constraint app_customers_phone_length check (char_length(phone) <= 15) not valid;

alter table public.app_customers
  drop constraint if exists app_customers_email_length,
  add constraint app_customers_email_length check (char_length(email) <= 30) not valid;

alter table public.app_customers
  drop constraint if exists app_customers_credit_limit_positive,
  add constraint app_customers_credit_limit_positive check (credit_limit >= 0) not valid;

create unique index if not exists app_customers_phone_key
on public.app_customers (phone);

create unique index if not exists app_customers_login_key
on public.app_customers (login);

create index if not exists app_customer_password_reset_requests_status_idx
on public.app_customer_password_reset_requests (status, created_at desc);

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

  if char_length(v_email) > 30 then
    raise exception 'Email deve ter ate 30 caracteres.';
  end if;

  return query
  insert into public.app_customers (
    name,
    login,
    password_hash,
    phone,
    position,
    email,
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
    'pendente',
    5,
    0
  )
  returning app_customers.id, app_customers.login, app_customers.status;
end;
$$;

revoke all on function public.app_customer_register(text, text, text, text, text, text) from public;
grant execute on function public.app_customer_register(text, text, text, text, text, text) to anon;
grant execute on function public.app_customer_register(text, text, text, text, text, text) to authenticated;

create or replace function public.app_customer_login(
  p_login text,
  p_password text
)
returns table (
  id bigint,
  name text,
  login text,
  phone text,
  customer_position text,
  email text,
  status text,
  payment_day int,
  credit_limit numeric
)
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  return query
  select
    c.id,
    c.name,
    c.login,
    c.phone,
    c.position as customer_position,
    c.email,
    c.status,
    c.payment_day,
    c.credit_limit
  from public.app_customers as c
  where c.login = trim(p_login)
    and c.password_hash is not null
    and crypt(trim(p_password), c.password_hash) = c.password_hash
  limit 1;
end;
$$;

revoke all on function public.app_customer_login(text, text) from public;
grant execute on function public.app_customer_login(text, text) to anon;
grant execute on function public.app_customer_login(text, text) to authenticated;

create or replace function public.app_customer_request_password_reset(
  p_login text,
  p_email text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_login text := trim(p_login);
  v_email text := lower(trim(p_email));
  v_customer_id bigint;
begin
  if v_login = '' or v_email = '' then
    raise exception 'Preencha login e email cadastrado.';
  end if;

  if char_length(v_login) > 20 then
    raise exception 'Login deve ter ate 20 caracteres.';
  end if;

  if char_length(v_email) > 30 then
    raise exception 'Email deve ter ate 30 caracteres.';
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
  end if;
end;
$$;

revoke all on function public.app_customer_request_password_reset(text, text) from public;
grant execute on function public.app_customer_request_password_reset(text, text) to anon;
grant execute on function public.app_customer_request_password_reset(text, text) to authenticated;

notify pgrst, 'reload schema';
