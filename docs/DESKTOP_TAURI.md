# PDV Dr. Cafe Desktop

Esta pasta deixa o projeto pronto para virar aplicativo instalavel no Windows com Tauri.

## Ordem profissional

1. Manter o PDV web estavel na Vercel.
2. Gerar o instalador desktop com `npm run tauri:build`.
3. Melhorar o cache local e sincronizacao offline por etapas.
4. Ligar impressora termica e gaveta de dinheiro por comando nativo ESC/POS.

## Comandos

```bash
npm run build
npm run tauri:dev
npm run tauri:build
```

## Impressora e gaveta

A ponte nativa ja existe em `src-tauri/src/lib.rs` com os comandos:

- `open_cash_drawer`
- `print_receipt`

No navegador comum, o PDV continua usando o bridge local em `http://127.0.0.1:8787/cash-drawer/open`.
No aplicativo desktop, o front tenta chamar primeiro o comando nativo do Tauri.

## Proximo ajuste tecnico

Para abrir a gaveta de verdade, o comando `open_cash_drawer` deve enviar o pulso ESC/POS para a impressora ligada a gaveta. Normalmente esse pulso e:

```text
ESC p 0 25 250
```

Isso depende do driver/porta configurado no Windows para a impressora `TRPSX88V0011CB0X`.
