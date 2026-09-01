---
plugin: dois-cerebros
versao: "1.2"
instalado-em: {{DATA_INSTALACAO}}
---

# Minha Config — {{NOME}}

> Camada de config do dois-cérebros. Editar aqui = comportamento muda na próxima sessão, sem reinstalar.
> **Client-neutral:** guarda só a **identidade do operador**. Os elos com cada coletivo (cliente, tribo,
> área) vivem em `_cerebro/vinculos/{coletivo}/config.md` — schema `vinculos-v1`.
> ⚠️ **Nunca materializar `_cerebro/clientes/`** — schema aposentado, substituído por `_cerebro/vinculos/`.

## Identidade (cross-cliente)

- nome: "{{NOME}}"
- emails: {{EMAILS}}          # um por contexto/empresa (ex.: interno; por cliente)
- papeis-estaveis: {{PAPEIS}} # papel efetivo por coletivo vem do registro do vínculo

## Vínculos ativos

> Um registro por coletivo (cliente, tribo, área) — schema `vinculos-v1`. Lido **antes** da carta de
> navegação do coletivo. O **coletivo ativo é ditado pelo Projeto Cowork** — resolvido casando o vault
> montado (o que tem `_cerebro/vault-config.md`) com o registro em `_cerebro/vinculos/{coletivo}/`.

- registro: "_cerebro/vinculos/"
- coletivo-ativo-default: null   # sem coletivo montado = NENHUM coletivo ativo. NUNCA assumir. Resolver sempre pelo coletivo montado (o que tem _cerebro/vault-config.md).

| Vínculo | Papel efetivo | Estado (hot cache) |
|---|---|---|
| _(nenhum ainda — entra via fábrica de cliente/tribo ou discovery-intake)_ | | |

## Como as skills usam este arquivo (sequência de resolução)

1. Ler `meu-config.md` → identidade do operador.
2. Detectar o vault coletivo montado (o que contém `_cerebro/vault-config.md`) → casar com um registro em `_cerebro/vinculos/` → **coletivo ativo**.
3. Do registro do vínculo (`config.md`): papel efetivo, e-mail de contexto. **Sem path** — path local vive só em `connect.config.json`, nunca aqui.
4. Ler `_cerebro/vault-config.md` do coletivo montado → empresa, cliente, URLs.
5. Estado/projetos ativos → `_cerebro/vinculos/{coletivo}/estado.md` (hot cache — substitui, nunca acumula; fonte de verdade é a nota do projeto no coletivo).

> Novo projeto ativo: a **fonte** é a nota do projeto no coletivo; a skill reflete a linha em `_cerebro/vinculos/{coletivo}/estado.md`. Nunca registrar projeto narrativamente aqui.
