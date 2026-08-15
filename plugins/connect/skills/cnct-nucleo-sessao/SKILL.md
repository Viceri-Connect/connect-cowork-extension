---
name: cnct-nucleo-sessao
description: >
  Restaura o contexto coletivo do Connect no INÍCIO de qualquer trabalho e sempre
  que o operador mencionar uma tarefa, projeto, demanda, cliente, reunião, ticket,
  ou pedir para "trabalhar em", "continuar", "retomar" algo — chamando a tool
  iniciar_sessao (identidade do operador + matriz montada em ./matriz + contexto
  lazy da camada 1). Use também quando o contexto precisar de aprofundamento
  ("consultar o vault", "onde está", "mais detalhe", "qual a norma/decisão"). Na
  primeira vez, conduz a configuração guiada dos caminhos (matriz, cérebro pessoal)
  via a tool configurar. É o FALLBACK do hook de SessionStart quando ele não dispara
  no Cowork — o mecanismo é o mesmo, só muda o gatilho.
metadata:
  version: "0.5.0"
  program: "Impulsa / Viceri"
---

# Connect — bootstrap e restauração de contexto

Instruções para o Claude. Objetivo: garantir que o contexto coletivo do Connect
esteja montado antes de qualquer trabalho, sem depender do hook de SessionStart.

## Quando disparar

- No **início de qualquer trabalho** ou à **primeira menção** de tarefa, projeto,
  demanda, cliente, reunião, ticket, ou pedido de "trabalhar em / retomar / continuar".
- Quando o contexto precisar **aprofundar** (consultar o vault, achar uma norma,
  decisão, arquivo, "onde está…").
- Executar **no máximo uma vez por sessão** para a restauração — depois de montado,
  não repetir (checar com `estado_sessao`).

## Protocolo

**Passo 1 — Checar estado (sem efeito colateral).**
Chamar a tool `estado_sessao` (passar o `session_id` da sessão, se conhecido).

- Se `montadoNestaSessao = true` → contexto já restaurado; **seguir o trabalho**, não repetir.
- Se `configurado = true` e ainda não montado → ir ao Passo 3.
- Se `configurado = false` → ir ao Passo 2 (1º uso).

**Passo 2 — Configuração guiada (só no 1º uso).**
Perguntar ao operador, em linguagem simples, **onde ficam** (caminhos locais):

1. a **matriz** (a pasta do vault coletivo que contém `_cerebro/vault-config.md`);
2. o **cérebro pessoal** (identidade), se houver.

Chamar a tool `configurar` com `vault_matriz` e/ou `cerebro_pessoal`.
- Se vier `invalidos` (path não existe / placeholder OneDrive não sincronizado),
  explicar e **re-perguntar** só o que faltou — nunca assumir um caminho.
- `home` (pasta fixa do Connect) usa o default do SO; só perguntar se o operador quiser mudar.
- **Ausência de vault de operador não é erro — é gatilho de nascimento (D97/D105).** Se não
  há `cerebro_pessoal`, ou a pasta apontada está **em branco** (sem `_cerebro/meu-config.md`),
  **delegar à skill `cnct-fabrica-operador`**: ela elicita a identidade e materializa o vault do
  zero, e ao final chama `configurar` por conta própria. Não tentar montar um vault que ainda
  não existe.

**Passo 3 — Restaurar o contexto coletivo.**
Chamar a tool `iniciar_sessao` (com o `session_id`, se conhecido). Ela devolve o
bloco "Connect — sessão iniciada" (identidade + `./matriz` + camada 1). Usar esse
bloco como contexto ativo; referenciar tudo por caminho relativo (ex.: `./matriz/_cerebro/...`).

**Passo 4 — Aprofundar sob demanda.**
Seguir os **ponteiros lazy** da camada 1 (modelo-roteamento, convenção de skills,
projetos, organização) conforme a necessidade. Quando a sessão precisar atuar num
**sub-vault tipado** (um conceito/entidade com casa própria — um projeto, uma tribo,
"minha gestão"), o modelo canônico é **grafo de manifestos** (D102): cada entidade é
**manifesto** (frontmatter da própria nota, na matriz) + **acervo** (na fonte). O
casamento conceito→origem acontece **na skill** (varredura de manifestos), e o índice
de sub-vaults é **derivado** dos manifestos, nunca autorado (P60/D35); o MCP entrega só
o **primitivo de mount** (`mount_junction`). Desmontar: `unmount_junction`.

> ⚠️ **Estado do código (resolver v0.4.0):** a tool `resolver` ainda casa o conceito por
> um registro **autorado** `_cerebro/sub-vaults.json` e monta a junction — comportamento
> vigente até o realinhamento. O contrato-alvo acima (índice derivado + casamento na
> skill) é o **P61**, aberto. Usar `resolver` como está hoje; não inventar o derivado
> antes do código existir.

## Regras

- **Nunca assumir cliente** nem hardcodar caminho — tudo vem da config resolvida.
- **Não repetir** a restauração se `estado_sessao` disser que já está montado.
- Montar dá o caminho estável; **não** concede acesso de leitura — se o Cowork pedir,
  conceder acesso à origem correspondente.
