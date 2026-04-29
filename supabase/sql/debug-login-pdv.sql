-- Rode no Supabase SQL Editor para diagnosticar o login do PDV.

select
  to_regclass('public.pdv_users') as tabela_pdv_users_existe,
  to_regprocedure('public.login_pdv_user(text,text)') as funcao_login_existe;

select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name = 'pdv_users'
order by ordinal_position;

select username, role
from public.pdv_users
order by username;

select * from public.login_pdv_user('admin', 'admin123');
select * from public.list_pdv_users();
