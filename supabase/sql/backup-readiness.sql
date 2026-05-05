-- Preparacao para controle de backups do PDV Dr. Cafe.
-- A rotina do frontend roda sem bloquear o caixa e guarda o pacote local.
-- Esta tabela deixa o Supabase pronto para registrar auditoria do backup
-- quando houver backend/edge function de armazenamento externo.

create table if not exists public.backup_runs (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  backup_date date not null,
  scheduled_time text not null default '20:00',
  opening_time text not null default '07:30',
  timezone text not null default 'America/Sao_Paulo',
  reason text not null,
  status text not null default 'sucesso',
  message text,
  tables_count int not null default 0
);

alter table public.backup_runs enable row level security;

drop policy if exists "backup runs admin read" on public.backup_runs;
create policy "backup runs admin read"
on public.backup_runs
for select
to anon, authenticated
using (true);

drop policy if exists "backup runs admin insert" on public.backup_runs;
create policy "backup runs admin insert"
on public.backup_runs
for insert
to anon, authenticated
with check (true);
