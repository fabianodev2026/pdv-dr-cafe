# Emails do App Dr. Cafe com Resend

## Decisao atual

Enquanto o Dr. Cafe nao tiver um dominio proprio configurado, usar o remetente de teste do Resend:

```text
Dr. Cafe <onboarding@resend.dev>
```

No Supabase, em Edge Functions > Secrets, configurar:

```text
RESEND_API_KEY=re_sua_chave_do_resend
EMAIL_FROM=Dr. Cafe <onboarding@resend.dev>
```

Observacao: o remetente `onboarding@resend.dev` serve para testes. Para clientes reais, o Resend pode limitar o envio apenas para o email verificado da conta. O envio profissional deve usar dominio proprio.

## Quando for trocar para dominio proprio

1. Comprar ou usar um dominio no Registro.br.
2. No Resend, abrir Domains e adicionar o dominio.
3. Copiar os registros DNS que o Resend mostrar.
4. No Registro.br, abrir o dominio e ir em DNS > Editar zona.
5. Adicionar os registros DNS do Resend.
6. Voltar no Resend e clicar em verificar.
7. Trocar o segredo `EMAIL_FROM` no Supabase para algo como:

```text
Dr. Cafe <noreply@seudominio.com.br>
```

## Arquivos relacionados

- `supabase/sql/app-customer-support-and-email-fix.sql`
- `supabase/functions/send-app-emails/index.ts`
- `src/components/CustomerApp.tsx`

