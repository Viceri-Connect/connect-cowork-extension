---
plugin: dois-cerebros
versao: "1.1"
instalado-em: {{DATA_INSTALACAO}}
---

# Minha Config — {{NOME}}

> Camada de config do dois-cérebros. Editar aqui = comportamento muda na próxima sessão, sem reinstalar.
> **Client-neutral:** guarda só a **identidade do operador**. Os elos com cada cliente (paths, squad, papéis) vivem em `_cerebro/clientes/{slug}/config.md`.

## Identidade (cross-cliente)

- nome: "{{NOME}}"
- emails: {{EMAILS}}          # um por contexto/empresa (ex.: interno; por cliente)
- papeis-estaveis: {{PAPEIS}} # papel efetivo por cliente vem do registro do cliente

## Clientes

> Um registro por cliente em `_cerebro/clientes/{slug}/config.md` (paths locais + squad + papéis). O **cliente ativo é ditado pelo Projeto Cowork** — resolvido casando o vault coletivo montado (o que tem `_cerebro/vault-config.md`) com o `slug` do registro.

- registro: "_cerebro/clientes/"
- cliente-ativo-default: null   # sem coletivo montado = NENHUM cliente ativo. NUNCA assumir. Resolver sempre pelo coletivo montado (o que tem _cerebro/vault-config.md).

| slug | registro | natureza |
|------|----------|----------|
| _(nenhum ainda — entra via fábrica de cliente / demand-intake)_ | | |

## Como as skills usam este arquivo (sequência de resolução)

1. Ler `meu-config.md` → identidade do operador.
2. Detectar o vault coletivo montado (o que contém `_cerebro/vault-config.md`) → casar com um registro em `clientes/` → **cliente ativo**.
3. Do registro do cliente: `path-vault-coletivo`, `path-delivery-hub`, `squad`, `papeis`.
4. Ler `{path-vault-coletivo}/_cerebro/vault-config.md` → empresa, cliente, URLs.
5. Estado/projetos ativos e repos locais → `_cerebro/clientes/{slug}/estado.md` e `.../repos.md`.

> Novo projeto ativo: a **fonte** é a nota do projeto no coletivo do cliente; a skill reflete a linha em `clientes/{slug}/estado.md`. Nunca registrar projeto narrativamente aqui.
