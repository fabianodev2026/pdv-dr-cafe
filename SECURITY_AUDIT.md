# Auditoria de seguranca do PDV Dr. Cafe

Data: 2026-05-02

Atualizacao: 2026-05-03

## Corrigido no app

- Rotas administrativas agora exigem perfil `admin` ou `gerente`, mesmo quando a pessoa tenta abrir a URL direta.
- A rota `/suporte-ia` agora exige perfil `suporte_tecnico`.
- O menu lateral foi alinhado com as permissoes, escondendo abas administrativas de usuarios sem permissao.
- Logs locais continuam disponiveis para diagnostico, mas campos sensiveis sao mascarados antes de salvar: senha, hash, CPF, telefone e email.
- Fila offline agora separa `sales` e `pending_payments`, evitando duplicar venda quando apenas a pendencia falha.
- Filas locais agora possuem retencao automatica: offline ate 7 dias e fiscal ate 30 dias.
- Tela de Suporte IA agora consegue sincronizar filas offline e fiscais com Supabase e remover itens sincronizados deste navegador.
- Fila fiscal agora tenta usar backend fiscal quando `VITE_FISCAL_API_URL` estiver configurado; sem backend, registra em `fiscal_requests`.
- Foi criado o SQL `supabase/sql/production-security-hardening.sql` para fechar RLS e permissoes abertas em producao.
- Foi criado `docs/PRODUCTION_ARCHITECTURE.md` com a divisao profissional entre React, Supabase, backend fiscal e suporte tecnico.
- Permissoes foram separadas por perfil: admin, gerente, caixa, garcom e suporte_tecnico.
- A impressao da notinha agora possui bloco fiscal da Nota Fiscal Paulista com area de QR Code quando houver CPF.

## Pontos seguros que ja existem

- Senhas do app de clientes usam bcrypt no frontend antes de salvar o cadastro.
- Senhas do sistema interno do PDV usam `pgcrypto`/bcrypt nas funcoes SQL `login_pdv_user` e `create_pdv_user`.
- CPF para Nota Fiscal Paulista esta formatado como `123.456.789-10` e separado do pagamento.
- A notinha mostra o padrao fiscal com CPF e QR Code pendente de emissao pelo backend fiscal.
- Falha de internet ou Supabase pode gerar fila local de venda offline para posterior conferencia.
- Fila fiscal e rascunho de suporte IA ficam separados para acompanhamento tecnico.

## Riscos que ainda precisam virar estrutura profissional

### 1. Politicas do Supabase ainda estao abertas

Arquivos SQL atuais ainda possuem politicas como `to anon`, `using (true)` e `with check (true)`.
Isso funciona para desenvolvimento, mas nao e seguro para PDV em producao porque qualquer pessoa com a chave anonima do frontend pode tentar ler ou alterar tabelas expostas.

Acao profissional recomendada:

- Usar Supabase Auth ou uma API propria no servidor para autenticar usuarios.
- Remover permissao direta do `anon` em tabelas internas sensiveis.
- Manter `anon` apenas para telas publicas realmente publicas, como cardapio.
- Concentrar operacoes sensiveis em RPCs ou backend com validacao de perfil.
- Nunca colocar `service_role` no frontend.

### 2. Dados fiscais e CPF precisam de cuidado maior

CPF, telefone, email e dados de venda sao dados pessoais. No modo offline eles podem ficar no `localStorage` do navegador.

Acao profissional recomendada:

- Definir tempo de retencao da fila offline.
- Sincronizar e apagar registros locais assim que forem enviados.
- Restringir acesso a telas que exibem CPF e filas fiscais.
- Considerar criptografia local se o computador do caixa for compartilhado.

### 3. Nota Fiscal Paulista ainda precisa de backend fiscal

O app esta preparado para coletar CPF e enfileirar a emissao, mas a comunicacao real com SEFAZ/Receita via certificado digital nao deve acontecer direto no navegador.

Acao profissional recomendada:

- Criar um servico backend fiscal.
- Armazenar o certificado digital em cofre/servidor seguro, nunca no React.
- O PDV deve enviar apenas a venda e o CPF para esse backend.
- O backend assina, transmite, consulta status e devolve protocolo/erro fiscal.

### 4. Ajuda com IA nao deve corrigir codigo automaticamente em producao

Uma IA pode ajudar a diagnosticar, criar rascunho de correcao e organizar logs. Para PDV profissional, a correcao automatica precisa passar por aprovacao tecnica.

Acao profissional recomendada:

- IA gera diagnostico e sugestao.
- Suporte tecnico revisa.
- Correcao vai para Git.
- Build/testes rodam.
- Somente depois a versao vai para o caixa.

## Checklist antes de producao

- [x] Preparar SQL para fechar RLS do Supabase por perfil.
- [x] Documentar backend fiscal para certificado e emissao.
- [x] Criar rotina de sincronizacao da fila offline.
- [x] Apagar dados pessoais locais depois da sincronizacao.
- [ ] Revisar todas as tabelas com CPF, email, telefone, vendas e senhas.
- [ ] Trocar senha padrao `admin123`.
- [ ] Rodar build e testes antes de publicar.
