-- Execute somente o SQL abaixo no Supabase SQL Editor.
-- Nao cole o caminho do arquivo no editor.
-- Ele permite login do PDV sem liberar leitura direta da tabela pdv_users.

create table if not exists public.pdv_users (
  id bigserial primary key,
  username text not null unique,
  password text not null,
  role text not null default 'caixa',
  created_at timestamptz not null default now()
);

alter table public.pdv_users
  add column if not exists username text,
  add column if not exists password text,
  add column if not exists role text default 'caixa',
  add column if not exists created_at timestamptz default now();

create unique index if not exists pdv_users_username_key
on public.pdv_users (username);

alter table public.pdv_users enable row level security;

drop function if exists public.login_pdv_user(text, text);

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
    and u.password = p_password
  limit 1;
$$;

revoke all on function public.login_pdv_user(text, text) from public;
grant execute on function public.login_pdv_user(text, text) to anon;
grant execute on function public.login_pdv_user(text, text) to authenticated;

-- Cria ou reseta o primeiro admin.
-- Troque a senha abaixo antes de executar, se quiser.
insert into public.pdv_users (username, password, role)
values ('admin', 'admin123', 'admin')
on conflict (username) do update
set password = excluded.password,
    role = excluded.role;

-- Teste esperado: deve retornar uma linha com username = admin e role = admin.
select * from public.login_pdv_user('admin', 'admin123');
