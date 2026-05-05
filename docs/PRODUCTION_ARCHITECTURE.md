# Estrutura profissional do PDV Dr. Cafe

## Camadas

1. React PDV
   - Operacao do caixa, mesas, quartos, pedidos, fila offline e suporte.
   - Usa somente `VITE_SUPABASE_ANON_KEY`.
   - Nao guarda certificado digital nem `service_role`.

2. Supabase
   - Banco de dados, RLS e funcoes SQL.
   - Em desenvolvimento ainda aceita politicas abertas.
   - Em producao deve executar `supabase/sql/production-security-hardening.sql`
     depois de migrar login para Supabase Auth ou backend.

3. Backend fiscal
   - Servico separado do React.
   - Guarda certificado digital em cofre/servidor.
   - Recebe venda, CPF e itens.
   - Assina, transmite, consulta status e grava protocolo/erro fiscal.
   - No frontend, configure `VITE_FISCAL_API_URL` para o endereco desse servico.

4. Suporte tecnico
   - A IA cria analise e sugestao.
   - Suporte tecnico revisa antes de alterar codigo.
   - Correcao passa por Git, build e teste.

## Contrato sugerido do backend fiscal

Endpoint:

```http
POST /fiscal/nfp/emitir
```

Entrada:

```json
{
  "saleId": "local-ou-id-do-banco",
  "customerCpf": "123.456.789-10",
  "totalAmount": 52.9,
  "paymentMethod": "pix",
  "items": [
    {
      "name": "Cafe expresso",
      "quantity": 1,
      "unit_price": 7.9,
      "total": 7.9
    }
  ]
}
```

Saida de sucesso:

```json
{
  "status": "emitida",
  "protocol": "protocolo-retornado-pelo-servico-fiscal",
  "issuedAt": "2026-05-03T12:00:00.000Z"
}
```

Saida de erro:

```json
{
  "status": "erro",
  "message": "Descricao segura do erro fiscal"
}
```

## Regras de seguranca

- Certificado digital nunca entra no React.
- `service_role` nunca entra em `.env` do frontend.
- CPF, telefone e email aparecem apenas para perfis autorizados.
- Fila offline deve sincronizar e apagar registros locais confirmados.
- Logs devem mascarar dados sensiveis.
- Alteracao automatica por IA deve ficar bloqueada em producao.
