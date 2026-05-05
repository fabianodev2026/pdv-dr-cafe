# Plano sem custo inicial - Dr. Cafe

## Objetivo

Rodar o PDV e o app do cliente na nuvem com o menor custo possivel no inicio.

## Estrutura escolhida

1. GitHub privado gratuito
   - Guarda o codigo-fonte.
   - Somente pessoas autorizadas conseguem ver ou alterar.

2. Supabase Free
   - Banco de dados na nuvem.
   - Bom para inicio e homologacao.
   - Para producao com movimento real, acompanhar limites e backups.

3. Vercel Hobby/Free
   - Publica o sistema web.
   - Integra com GitHub.
   - Cada push na branch `main` pode gerar nova versao online.

4. PWA instalavel
   - Cliente instala no celular pelo navegador.
   - Sem Play Store no inicio.
   - Sem App Store no inicio.

## Passos para publicar na Vercel

1. Entrar em https://vercel.com.
2. Conectar a conta GitHub.
3. Importar o repositorio `pdv-dr-cafe`.
4. Framework: Vite.
5. Build command: `npm run build`.
6. Output directory: `dist`.
7. Configurar variaveis:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_FISCAL_API_URL` somente quando houver backend fiscal.
8. Fazer o deploy.

## Como instalar no celular

Android/Chrome:

1. Abrir a URL publicada.
2. Tocar nos tres pontos do Chrome.
3. Tocar em `Adicionar a tela inicial` ou `Instalar app`.

iPhone/Safari:

1. Abrir a URL publicada.
2. Tocar no botao de compartilhar.
3. Tocar em `Adicionar a Tela de Inicio`.

## Quando sair do gratuito

Migrar para planos pagos quando:

- O sistema virar producao diaria do comercio.
- O banco chegar perto do limite.
- Precisar de suporte/colaboracao profissional.
- Precisar de backups mais fortes e restauracao com menos risco.
- Precisar de APK na Play Store ou app iOS na App Store.
