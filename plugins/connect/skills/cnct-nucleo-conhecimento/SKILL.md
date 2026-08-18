---
name: cnct-nucleo-conhecimento
description: >
  This skill should be used when the user asks to "restaurar contexto", "iniciar
  sessao do Connect", "consultar a matriz", "ler o vault", "montar"/"desmontar"
  uma knowledge root, or refers to files under a mounted alias (ex.: ./matriz,
  ./pessoal) inside the Cowork workspace. Defines the Connect protocol for reaching
  knowledge through dynamic, workspace-relative paths backed by junctions/symlinks,
  and for starting a session (iniciar_sessao) or mounting on demand via the
  connect MCP server.
metadata:
  version: "0.4.0"
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

Quando uma skill precisa atuar num **sub-vault tipado** (um conceito/entidade com casa
própria — um delivery hub, um vault de squad, a gestão pessoal), o Connect o entrega
como um novo atalho no workspace. Modelo canônico (D102): cada entidade é **manifesto**
(frontmatter da própria nota, na matriz) + **acervo** (na fonte da entidade); o grafo de
dependências entre vaults é declarado nos manifestos, não numa árvore rígida.

- **Casamento conceito→entidade acontece no `resolver`** (MCP), mas **quem decide o que
  fazer com o `status`** é a skill (D93/P61) — o `resolver` nunca pergunta nada nem
  advinha path, só devolve o fato.
- **Índice derivado**, nunca autorado (P60/D35): enumerar entidades é varredura de
  manifestos; registro paralelo às notas está proibido (D97).
- **Path é sempre por-operador, por-máquina** (D35): nenhum manifesto declara diretório
  ou URL. O `resolver` casa a entidade (por `conceito`) e devolve `status`; o path local
  mora só em `connect.config.json` (`subVaults`, indexado por `conceito`), gravado por
  `registrar_subvault_local`.
- **O MCP entrega o primitivo de mount** (`mount_junction` por caminho) e o primitivo de
  registro local (`registrar_subvault_local`); `resolver` é a interface de alto nível que
  os combina. Desmontar: `unmount_junction`. Auditar: `list_mounts`.

## Resolve-on-touch — regra permanente, não fluxo de uma vez

Vale pra **toda nota aberta**, na matriz ou já dentro de um sub-vault montado, em
**qualquer** ponto da sessão — recursivo, sem limite de profundidade (grafo, D102, não
árvore de profundidade 1). Nota com `tipo`+`externo:true` no frontmatter é fronteira:
resolver antes de seguir referência pra dentro dela. Uma vez resolvido nesta sessão, o
alias é conhecido e estável — não repetir `resolver` pro mesmo `conceito`.

> ✅ **Estado do código (resolver v0.11.0):** o manifesto não guarda mais `fonte`/`url` —
> só `externo` (bool), `criado-por`/`criado-em` (já materializado?) e `entrada` (nota-hub);
> o `conceito` já existente (default: slug do arquivo) é reaproveitado como chave local
> (não inventamos `escopo` — já usado em toda a matriz pra governança/cliente). Status
> possíveis: `nao-encontrado`, `sem-acervo-externo`,
> `pendente-criacao`, `local-nao-configurado`, `origem-ausente`, `sem-workspace`,
> `erro-mount`, `resolvido`. Registro autorado `sub-vaults.json` continua **removido**
> (contrato-manifesto §3). Contrato: `config/contrato-manifesto.md`.

## Erros comuns

- **"item real (não-junction)"**: já existe uma pasta de verdade com o nome do
  alias. Escolha outro alias — o Connect nunca sobrescreve dados reais.
- **`local-nao-configurado`**: esta máquina nunca resolveu esse `conceito` — pergunte o
  diretório ao operador e grave com `registrar_subvault_local` antes de tentar montar.
- **Origem não encontrada**: em projeto nuvem, o caminho da origem difere do
  caminho Windows; ajuste a origem para o caminho correspondente.
