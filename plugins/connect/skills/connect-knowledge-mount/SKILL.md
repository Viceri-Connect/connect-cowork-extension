---
name: connect-knowledge-mount
description: >
  This skill should be used when the user asks to "restaurar contexto", "iniciar
  sessao do Connect", "consultar a matriz", "ler o vault", "montar"/"desmontar"
  uma knowledge root, or refers to files under a mounted alias (ex.: ./matriz,
  ./pessoal) inside the Cowork workspace. Defines the Connect protocol for reaching
  knowledge through dynamic, workspace-relative paths backed by junctions/symlinks,
  and for starting a session (iniciar_sessao) or mounting on demand via the
  connect MCP server.
metadata:
  version: "0.2.0"
  program: "Impulsa / Viceri"
---

# Connect — protocolo de contexto por caminho dinâmico

O Connect expõe fontes de conhecimento (a matriz, o cérebro pessoal, sub-vaults,
diretórios sincronizados com SharePoint/OneDrive) como **aliases "flat" dentro do
workspace da sessão**. Cada alias é uma junction (Windows) ou symlink (POSIX)
criada pela extensão — no início da sessão (hook → `iniciar_sessao`) ou sob
demanda (MCP).

## Princípios (seguir sempre)

1. **Caminho relativo, nunca absoluto.** Referencie conhecimento pelo alias
   relativo ao workspace (ex.: `./matriz/_cerebro/vault-config.md`), jamais por
   caminho absoluto de máquina (`C:\Users\...`). Mantém a leitura portável.
2. **Mount não é acesso.** A junction dá um caminho estável; ela **não** concede
   permissão de leitura. Se o Cowork pedir, conceda acesso ao diretório de ORIGEM
   correspondente.
3. **Lazy antes de tudo.** No boot só a camada 1 vem inline; o resto é ponteiro.
   Leia sob demanda, seguindo os ponteiros que o bloco de contexto lista.

## Início de sessão

O hook `SessionStart` chama `iniciar_sessao` automaticamente: cria o scaffold da
sessão (fora do OneDrive), monta `./matriz`, restaura a identidade do operador e
injeta o bloco "Connect — sessão iniciada". Para reiniciar o contexto manualmente,
chame a tool MCP `iniciar_sessao`.

## Sub-vault sob demanda (conceito → atalho)

Quando uma skill declara que precisa de um sub-vault (um **conceito**, ex.: um
delivery hub, um vault de squad, a gestão pessoal), o Connect o entrega como um novo
atalho no workspace pela tool **`resolver`** (`conceito`, `workspace_dir`, `alias?`,
`replace?`). O `resolver` lê o **registro declarativo** `_cerebro/sub-vaults.json`
(no cérebro pessoal e/ou na matriz), casa o conceito por nome ou gatilho, monta a
junction/symlink da origem e devolve a camada 1 do sub-vault. O primitivo de baixo
nível (`mount_junction`) segue disponível para montagens ad-hoc por caminho.
Desmontar: `unmount_junction`. Auditar: `list_mounts`.

**Registro declarativo** (`_cerebro/sub-vaults.json`) — lista de entradas:

```json
[
  { "conceito": "gestao-financeira", "origem": "D:\\caminho\\do\\sub-vault",
    "alias": "gestao", "gatilhos": ["financas", "pensao", "orcamento"],
    "nota": "minha gestao pessoal e financeira" }
]
```

## Erros comuns

- **"item real (não-junction)"**: já existe uma pasta de verdade com o nome do
  alias. Escolha outro alias — o Connect nunca sobrescreve dados reais.
- **Origem não encontrada**: em projeto nuvem, o caminho da origem difere do
  caminho Windows; ajuste a origem para o caminho correspondente.
