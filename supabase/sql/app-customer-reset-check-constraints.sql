-- Reset controlado das CHECK constraints do cadastro do app.
-- Use quando o app mostrar codigo suporte 23514 ao cadastrar.
--
-- 23514 significa que alguma CHECK constraint antiga da tabela app_customers
-- recusou o cadastro. Este script remove somente CHECK constraints dessa tabela
-- e recria as regras atuais usadas pelo app.

do $$
declare
  constraint_record record;
begin
  for constraint_record in
    select conname
    from pg_constraint
    where conrelid = 'public.app_customers'::regclass
      and contype = 'c'
  loop
    execute format(
      'alter table public.app_customers drop constraint if exists %I',
      constraint_record.conname
    );
  end loop;
end;
$$;

alter table public.app_customers
  add constraint app_customers_name_length
  check (char_length(name) <= 25) not valid;

alter table public.app_customers
  add constraint app_customers_login_length
  check (char_length(login) <= 20) not valid;

alter table public.app_customers
  add constraint app_customers_position_length
  check (char_length(position) <= 20) not valid;

alter table public.app_customers
  add constraint app_customers_phone_length
  check (char_length(phone) <= 15) not valid;

alter table public.app_customers
  add constraint app_customers_email_length
  check (char_length(email) <= 30) not valid;

alter table public.app_customers
  add constraint app_customers_status_check
  check (status in ('pendente', 'ativo', 'bloqueado')) not valid;

alter table public.app_customers
  add constraint app_customers_payment_day_check
  check (payment_day between 1 and 31) not valid;

alter table public.app_customers
  add constraint app_customers_credit_limit_positive
  check (credit_limit >= 0) not valid;

notify pgrst, 'reload schema';
