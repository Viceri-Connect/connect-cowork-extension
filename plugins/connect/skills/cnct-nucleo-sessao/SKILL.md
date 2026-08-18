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
  version: "0.6.0"
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

**Passo 4 — Aprofundar sob demanda (resolve-on-touch, disciplina fixa).**
Seguir os **ponteiros lazy** da camada 1 (modelo-roteamento, convenção de skills,
projetos, organização) conforme a necessidade. Ao nomear ou tocar num **sub-vault
tipado** (um conceito/entidade com casa própria — um projeto, uma tribo, "minha
gestão"), ou ao abrir qualquer nota que declare `tipo`+`externo:true` no frontmatter:

1. Chamar `resolver(conceito)` **antes** de seguir qualquer referência pra dentro dela.
   Nunca grep, nunca varredura de pastas, nunca adivinhação — nem como contorno.
2. Tratar o `status` devolvido (nunca contornar):
   - `sem-acervo-externo` → conteúdo mora na própria matriz, seguir lendo normal.
   - `pendente-criacao` → entidade existe, acervo não. Oferecer a `cnct-fabrica-<tipo>`
     ao operador — nunca criar nada sozinho.
   - `local-nao-configurado` → esta máquina nunca resolveu esse `conceito`. Perguntar o
     diretório ao operador, gravar com `registrar_subvault_local`, repetir.
   - `origem-ausente` → path conhecido mas não existe/não sincronizado. Avisar.
   - `resolvido` → pedir acesso ao Cowork, montar, e se houver `entrada`, pousar direto
     nela.
3. Uma vez resolvido, o alias vale pro resto da sessão — não repetir `resolver` pro
   mesmo `conceito`; navegação dentro dele é path relativo normal.

O modelo canônico é **grafo de manifestos** (D102): cada entidade é **manifesto**
(frontmatter puro — nunca path/url, D35) + **acervo** (no diretório que cada operador
informa). O casamento conceito→entrada acontece **no `resolver`**, e o índice é
**derivado** dos manifestos, nunca autorado (P60/D35); o path local vive só em
`connect.config.json` (`subVaults`), nunca no vault.

> ✅ **Estado do código (resolver v0.11.0):** o manifesto não guarda mais `fonte`/`url`
> em nenhum formato — só `externo`, `criado-por`/`criado-em`, `entrada` (e o `conceito`
> já existente, reaproveitado como chave local). O
> `resolver` nunca advinha nem pergunta; devolve `status` pra esta skill decidir. Registro
> autorado `sub-vaults.json` continua **removido** (contrato-manifesto §3). Corte de raiz
> sobre o P69: não existe mais path pra formatar errado no coletivo.

## Regras

- **Nunca assumir cliente** nem hardcodar caminho — tudo vem da config resolvida.
- **Não repetir** a restauração se `estado_sessao` disser que já está montado.
- Montar dá o caminho estável; **não** concede acesso de leitura — se o Cowork pedir,
  conceder acesso à origem correspondente.
