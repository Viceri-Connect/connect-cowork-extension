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
  version: "0.3.0"
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

- **Casamento conceito→origem acontece na skill**, não no servidor MCP (D93/P61): a
  skill varre os manifestos, encontra a entidade e resolve a origem.
- **Índice derivado**, nunca autorado (P60/D35): enumerar entidades é varredura de
  manifestos; registro paralelo às notas está proibido (D97).
- **O MCP entrega só o primitivo de mount** (`mount_junction` por caminho); `resolver` é
  a interface de alto nível. Desmontar: `unmount_junction`. Auditar: `list_mounts`.

> ⚠️ **Estado do código (resolver v0.4.0):** hoje a tool `resolver` ainda casa o conceito
> por um **registro autorado** `_cerebro/sub-vaults.json` (no cérebro pessoal e/ou na
> matriz) e monta a junction. Esse é o comportamento vigente até o realinhamento — o alvo
> acima (índice derivado + casamento na skill) é o **P61**, aberto. Enquanto o código não
> muda, é `sub-vaults.json` que faz o `resolver` funcionar:
>
> ```json
> [
>   { "conceito": "gestao-financeira", "origem": "D:\\caminho\\do\\sub-vault",
>     "alias": "gestao", "gatilhos": ["financas", "pensao", "orcamento"],
>     "nota": "minha gestao pessoal e financeira" }
> ]
> ```

## Erros comuns

- **"item real (não-junction)"**: já existe uma pasta de verdade com o nome do
  alias. Escolha outro alias — o Connect nunca sobrescreve dados reais.
- **Origem não encontrada**: em projeto nuvem, o caminho da origem difere do
  caminho Windows; ajuste a origem para o caminho correspondente.
