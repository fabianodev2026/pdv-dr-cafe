# Regras recomendadas no GitHub

## Objetivo

Proteger o codigo do PDV Dr. Cafe para que ninguem altere a versao principal sem controle.

## Configuracao principal

Repositorio:

```txt
https://github.com/fabianodev2026/pdv-dr-cafe
```

Branch principal:

```txt
main
```

## Regra ideal para a branch main

No GitHub:

```txt
Repository > Settings > Rules > Rulesets > New ruleset > New branch ruleset
```

Nome:

```txt
Protect main
```

Target branches:

```txt
Include default branch
```

Enforcement status:

```txt
Active
```

Ative estas regras:

- Restrict deletions.
- Block force pushes.
- Require a pull request before merging.
- Require approvals: 1.
- Dismiss stale pull request approvals when new commits are pushed.
- Require review from Code Owners.
- Require status checks to pass.
- Require branches to be up to date before merging.
- Require linear history.
- Require conversation resolution before merging.

Status check obrigatorio:

```txt
TypeScript, tests and build
```

## Quem pode alterar

- Voce deve ser o unico admin.
- Suporte tecnico deve ter acesso temporario e minimo necessario.
- Evite dar permissao `Admin` para outras pessoas.
- Para colaboradores, prefira `Read` ou `Write`, nunca `Admin`.

## Importante sobre plano gratuito

Em repositorio privado gratuito, algumas regras avancadas podem aparecer bloqueadas pelo GitHub.
Se isso acontecer, mantenha pelo menos:

- repositorio privado;
- apenas voce como admin;
- autenticacao em duas etapas;
- commits frequentes;
- GitHub Actions rodando validacao;
- alteracoes feitas por branch separada antes de entrar na `main`.

## Fluxo seguro de trabalho

1. Criar branch para cada mudanca.
2. Fazer commit nessa branch.
3. Abrir Pull Request para `main`.
4. Esperar a validacao `Validate PDV`.
5. Revisar o que mudou.
6. Fazer merge.
7. A Vercel publica a nova versao.

## Nunca colocar no GitHub

- Senha de usuario.
- Certificado digital.
- Senha do certificado.
- Chave `service_role` do Supabase.
- Arquivo `.env` real.
- Dados pessoais de clientes.
