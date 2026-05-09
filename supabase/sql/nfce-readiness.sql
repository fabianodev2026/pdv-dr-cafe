-- Preparacao NFC-e Dr. Cafe.
-- Este SQL nao emite nota. Ele deixa o banco pronto para receber configuracoes,
-- fila de emissao, retorno do backend fiscal, XML autorizado e QR Code oficial.
--
-- Segurança:
-- As tabelas ficam com RLS ligado e sem politica publica aberta.
-- A gravacao real deve ser feita por backend fiscal seguro usando credencial de servico.

create table if not exists public.nfce_settings (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  environment text not null default 'homologacao',
  cnpj text,
  state_inscription text,
  corporate_name text,
  trade_name text,
  city_code_ibge text,
  state text not null default 'SP',
  certificate_name text,
  certificate_ready boolean not null default false,
  series text not null default '1',
  next_number bigint not null default 1,
  status text not null default 'pre_configuracao'
);

create table if not exists public.nfce_issues (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  sale_id text,
  environment text not null default 'homologacao',
  customer_cpf text,
  total_amount numeric(10,2) not null default 0,
  payment_method text,
  items jsonb not null default '[]'::jsonb,
  request_payload jsonb not null default '{}'::jsonb,
  status text not null default 'aguardando_certificado',
  access_key text,
  protocol text,
  qr_code_url text,
  qr_code_text text,
  xml_authorized text,
  danfe_html text,
  issued_at timestamptz,
  error_message text
);

alter table public.nfce_settings enable row level security;
alter table public.nfce_issues enable row level security;

create index if not exists nfce_issues_status_created_at_idx
on public.nfce_issues (status, created_at desc);

create index if not exists nfce_issues_sale_id_idx
on public.nfce_issues (sale_id);
