# Retomar Projeto - PDV Dr. Cafe

## Projeto correto

Pasta:

```txt
C:\Users\Oem\Documents\Codex\2026-04-28\https-chatgpt-com-share-69f15d35-a5e8\pdv-dr-cafe
```

Repositorio GitHub:

```txt
https://github.com/fabianodev2026/pdv-dr-cafe.git
```

Ultimo ponto salvo antes deste arquivo:

```txt
dcb01ec Add diagnostics and bcrypt password security
```

## URLs locais

App do cliente:

```txt
http://127.0.0.1:5177/app
```

Sistema interno:

```txt
http://127.0.0.1:5177/
```

Diagnostico:

```txt
http://127.0.0.1:5177/diagnostico
```

## O que foi implementado

- App do cliente com cadastro, login e senha.
- Login do app usando bcrypt via `bcryptjs`.
- Login do sistema interno preparado para bcrypt via Supabase `pgcrypto`.
- Tela de diagnostico para logs locais do app.
- Mascara de telefone no cadastro: `(11) 99999-9999`.
- Nome, login e cargo em maiusculas no cadastro.
- Limites centralizados em `src/lib/customerLimits.ts`.

## Arquivos importantes

```txt
src/components/CustomerApp.tsx
src/components/LoginScreen.tsx
src/components/ConfigManager.tsx
src/components/DiagnosticsManager.tsx
src/lib/passwordSecurity.ts
src/lib/appLogger.ts
src/lib/customerLimits.ts
supabase/sql/app-customer-features.sql
supabase/sql/pdv-users-bcrypt-migration.sql
```

## Pendencias para executar no Supabase

Executar no SQL Editor:

```txt
supabase/sql/app-customer-features.sql
supabase/sql/pdv-users-bcrypt-migration.sql
```

Depois testar:

```txt
usuario: admin
senha: admin123
```

Em seguida, criar/trocar os usuarios reais pelo painel `Usuarios`.

## Validacoes feitas

```txt
node node_modules\typescript\bin\tsc
node scripts\test-blocks.mjs
node node_modules\vite\bin\vite.js build
```

Todas passaram no ultimo ciclo.
