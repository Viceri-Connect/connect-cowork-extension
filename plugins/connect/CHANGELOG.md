# Changelog — connect

## 0.4.0 — 2026-08-15
- **`resolver(conceito)` implementado** (era roadmap): entrega um sub-vault por
  CONCEITO como atalho flat no workspace. Lê um **registro declarativo**
  (`_cerebro/sub-vaults.json`) no cérebro pessoal e/ou na matriz (pessoal vence),
  casa o conceito por nome ou gatilho, monta a junction/symlink da origem e carrega
  a camada 1 do sub-vault (quando ele tem forma de vault). Novo `lib/resolver.mjs`
  (zero-dep) e tool MCP `resolver` (`conceito`, `workspace_dir`, `alias?`, `replace?`).
- Registro declarativo `_cerebro/sub-vaults.json`: lista de
  `{ conceito, origem, alias?, gatilhos?[], nota? }` — o "ponteiro declarativo" que
  deixa a próxima sessão saber o caminho de cada contexto.
- Teste `spike-resolver` (casar por conceito/gatilho/substring, montar, ler através
  do atalho, origem intacta, L1, idempotência, não-encontrado).

## 0.3.0 — 2026-08-14
- Repo tratado como **marketplace** (`impulsa`) instalável no Cowork pela **URL do
  repo git**; `.plugin` de um clique mantido como caminho secundário
  (`scripts/build-plugin.sh`). CLI do Claude Code rebaixada a dev-only.
- **Configuração guiada do 1º uso**: tool `configurar` grava os caminhos em
  `connect.config.json` (atualização parcial, valida existência, reporta inválidos).
- Tool `estado_sessao`: checagem leve (configurado? montado nesta sessão?) sem efeito colateral.
- Skill **connect-bootstrap**: fallback do hook — dispara em qualquer menção a
  trabalho e restaura o contexto coletivo (identidade + matriz + camada 1); conduz
  a config guiada; aprofunda sob demanda. Mesmo mecanismo do hook, gatilho por skill.

## 0.2.0 — 2026-08-14
- Reconcebida a superfície do MCP (decisão 2026-08-14): **sem entidade "cliente"**.
  Adicionada a tool `iniciar_sessao` (bootstrap da sessão); primitivos de mount
  (`mount_junction`/`unmount_junction`/`list_mounts`) mantidos como base do futuro
  `resolver`.
- `iniciar_sessao`: cria o scaffold da sessão fora do OneDrive, monta a **matriz**
  como `./matriz`, restaura a **identidade** do operador (cérebro pessoal) e carrega
  o **contexto lazy da camada 1** da matriz (inline curto + ponteiros).
- Núcleo reorganizado em `lib/` (mount, matriz, session, render), zero-dep.
- Hook `SessionStart` (`type: command`, matcher `startup|resume|fork`) chama o mesmo
  núcleo do `iniciar_sessao`.
- Repositório reestruturado no padrão marketplace + `plugins/connect/` (PACKAGING §3).
- Testes: `spike-mecanismo` (15 checagens, ponta a ponta) e `handshake-mcp`.

## 0.1.0 — 2026-08-13 (banco de provas, lab)
- Primitivo de mount provado na máquina real: junction NTFS (mount/read/unmount,
  origem intacta), MCP handshake, hook SessionStart montando aliases de config,
  travas de segurança. Origem: `D:\Impulsa\lab\lab\connect`.
