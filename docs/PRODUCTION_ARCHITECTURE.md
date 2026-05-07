# Estrutura profissional do PDV Dr. Cafe

## Camadas

1. React PDV
   - Operacao do caixa, mesas, quartos, pedidos, fila offline e suporte.
   - Usa somente `VITE_SUPABASE_ANON_KEY`.
   - Nao guarda certificado digital nem `service_role`.
   - Abertura de gaveta usa ponte local de hardware no PC do caixa.

2. Supabase
   - Banco de dados, RLS e funcoes SQL.
   - Em desenvolvimento ainda aceita politicas abertas.
   - Em producao deve executar `supabase/sql/production-security-hardening.sql`
     depois de migrar login para Supabase Auth ou backend.

3. Backend fiscal
   - Servico separado do React.
   - Guarda certificado digital em cofre/servidor.
   - Recebe venda, CPF e itens.
   - Assina, transmite, consulta status e grava protocolo, QR Code e erro fiscal.
   - No frontend, configure `VITE_FISCAL_API_URL` para o endereco desse servico.

4. Suporte tecnico
   - A IA cria analise e sugestao.
   - Suporte tecnico revisa antes de alterar codigo.
   - Correcao passa por Git, build e teste.

## Perfis do sistema

- `admin`: acesso total, usuarios, configuracoes, produtos, clientes app, financeiro, diagnostico e PDV.
- `gerente`: operacao, produtos, almoco do dia, clientes app, financeiro e diagnostico.
- `caixa`: PDV, fechamento, pagar depois, pedidos e financeiro.
- `garcom`: lancar pedido e enviar para preparo, sem finalizar pagamento.
- `suporte_tecnico`: diagnostico e suporte IA, sem operar caixa.

## Limite do app de clientes

- Cada cliente do app pode ter um `credit_limit`.
- Somente `admin` altera limite ou exclui conta gerada pelo app.
- O app mostra limite, saldo em aberto e saldo disponivel.
- Pedido pelo app nao abre gaveta porque o pagamento e futuro.

## Gaveta de dinheiro

- Marca: Brasil PC.
- Numero de serie: 715sz25081460.
- Abertura acontece somente apos pagamento concluido no PDV.
- Pedidos do app nao abrem gaveta.
- Como navegador/PWA nao controla hardware diretamente, o PDV envia o comando para uma ponte local:

```txt
VITE_CASH_DRAWER_URL=http://127.0.0.1:8787/cash-drawer/open
```

Essa ponte local deve ficar instalada no PC do caixa e converter o comando web para o acionamento real da gaveta/impressora.

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
  "qrCodeUrl": "https://url-oficial-ou-imagem-do-qr-code",
  "qrCodeText": "conteudo-oficial-do-qr-code",
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
- QR Code da Nota Fiscal Paulista deve vir do backend fiscal/SEFAZ depois da emissao.
- CPF, telefone e email aparecem apenas para perfis autorizados.
- Fila offline deve sincronizar e apagar registros locais confirmados.
- Logs devem mascarar dados sensiveis.
- Alteracao automatica por IA deve ficar bloqueada em producao.
