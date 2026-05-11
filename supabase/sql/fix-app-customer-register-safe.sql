-- Execute no Supabase SQL Editor se o cadastro de cliente no app falhar.
-- Seguro para sistema em funcionamento: nao apaga clientes, pedidos ou vendas.

create extension if not exists pgcrypto;

create table if not exists public.app_customers (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  name text not null,
  login text,
  password_hash text,
  phone text not null,
  position text,
  email text,
  email_verified boolean not null default false,
  status text not null default 'pendente',
  payment_day int not null default 5,
  credit_limit numeric(10,2) not null default 0
);

alter table public.app_customers
  add column if not exists login text,
  add column if not exists password_hash text,
  add column if not exists position text,
  add column if not exists email text,
  add column if not exists email_verified boolean not null default false,
  add column if not exists status text not null default 'pendente',
  add column if not exists payment_day int not null default 5,
  add column if not exists credit_limit numeric(10,2) not null default 0;

alter table public.app_customers
  drop constraint if exists app_customers_phone_key;

drop index if exists public.app_customers_phone_key;

create index if not exists app_customers_phone_idx
on public.app_customers (phone);

create index if not exists app_customers_login_idx
on public.app_customers (login)
where login is not null and login <> '';

create table if not exists public.app_customer_email_verifications (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  customer_id bigint not null references public.app_customers(id) on delete cascade,
  email text not null,
  token_hash text not null,
  expires_at timestamptz not null,
  used_at timestamptz
);

create index if not exists app_customer_email_verifications_token_idx
on public.app_customer_email_verifications (token_hash);

create table if not exists public.app_email_outbox (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  to_email text not null,
  subject text not null,
  text_body text,
  html_body text,
  metadata jsonb not null default '{}'::jsonb,
  status text not null default 'pending',
  sent_at timestamptz,
  error_message text
);

create index if not exists app_email_outbox_status_idx
on public.app_email_outbox (status, created_at);

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

alter table public.app_customers enable row level security;
alter table public.app_customer_email_verifications enable row level security;
alter table public.app_email_outbox enable row level security;

drop policy if exists "app customers read" on public.app_customers;
create policy "app customers read"
on public.app_customers
for select
to anon, authenticated
using (true);

drop policy if exists "app customers update" on public.app_customers;
create policy "app customers update"
on public.app_customers
for update
to anon, authenticated
using (true)
with check (true);

notify pgrst, 'reload schema';
