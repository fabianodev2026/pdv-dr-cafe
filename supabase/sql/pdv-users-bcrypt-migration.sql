-- Execute no Supabase SQL Editor para trocar o login do sistema interno para bcrypt.
-- Depois de rodar, a senha padrao do admin fica admin123. Troque pelo painel Usuarios.

create extension if not exists pgcrypto;

create table if not exists public.pdv_users (
  id bigserial primary key,
  username text not null unique,
  password_hash text,
  role text not null default 'caixa',
  created_at timestamptz not null default now()
);

alter table public.pdv_users
  add column if not exists password_hash text;

create unique index if not exists pdv_users_username_key
on public.pdv_users (username);

alter table public.pdv_users enable row level security;

drop function if exists public.login_pdv_user(text, text);
drop function if exists public.list_pdv_users();
drop function if exists public.create_pdv_user(text, text, text);

create or replace function public.login_pdv_user(
  p_username text,
  p_password text
)
returns table (
  username text,
  role text
)
language sql
security definer
set search_path = public
as $$
  select u.username, u.role
  from public.pdv_users as u
  where lower(u.username) = lower(trim(p_username))
    and u.password_hash is not null
    and crypt(p_password, u.password_hash) = u.password_hash
  limit 1;
$$;

revoke all on function public.login_pdv_user(text, text) from public;
grant execute on function public.login_pdv_user(text, text) to anon;
grant execute on function public.login_pdv_user(text, text) to authenticated;

create or replace function public.list_pdv_users()
returns table (
  username text,
  role text
)
language sql
security definer
set search_path = public
as $$
  select u.username, u.role
  from public.pdv_users as u
  where u.username is not null
  order by u.username;
$$;

revoke all on function public.list_pdv_users() from public;
grant execute on function public.list_pdv_users() to anon;
grant execute on function public.list_pdv_users() to authenticated;

create or replace function public.create_pdv_user(
  p_username text,
  p_password text,
  p_role text
)
returns table (
  username text,
  role text
)
language sql
security definer
set search_path = public
as $$
  insert into public.pdv_users (username, password_hash, role)
  values (trim(p_username), crypt(p_password, gen_salt('bf', 10)), p_role)
  on conflict (username) do update
  set password_hash = excluded.password_hash,
      role = excluded.role
  returning pdv_users.username, pdv_users.role;
$$;

revoke all on function public.create_pdv_user(text, text, text) from public;
grant execute on function public.create_pdv_user(text, text, text) to anon;
grant execute on function public.create_pdv_user(text, text, text) to authenticated;

insert into public.pdv_users (username, password_hash, role)
values ('admin', crypt('admin123', gen_salt('bf', 10)), 'admin')
on conflict (username) do update
set password_hash = excluded.password_hash,
    role = excluded.role;
