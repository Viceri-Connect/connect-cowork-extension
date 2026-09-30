---
name: cnct-fabrica-operador
description: >
  Provisiona do ZERO, por elicitação, um vault de operador do dois-cérebros
  (identidade cross-cliente + delta de comportamento), materializando a forma
  genérica que o produto entrega. Dispara quando: instalação sem cérebro pessoal,
  operador aponta uma pasta em branco, pedidos como "criar meu vault", "configurar
  meu cérebro pessoal", "provisionar operador", "criar minha rotina", "criar/agendar
  meu briefing diário" (também para operador já provisionado), ou quando o cnct-nucleo-sessao
  detecta ausência de vault de operador e delega. Convenção cnct-fabrica-<tipo>: esta é
  a fábrica do tipo "operador" (implementação de referência do padrão em FRAMEWORK.md).
  Roda no estado zero — não exige coletivo montado. Estado zero é gatilho de
  nascimento, não erro.
metadata:
  version: "0.4.0"
  eixo: nucleo
  program: "Impulsa / Viceri"
  camada: "L2 — fábrica por tipo"
---

# Connect — fábrica de vault de operador

Instruções para o Claude. Objetivo: **nascer** um vault de operador completo por
elicitação, sem exigir coletivo montado. Implementação de referência do padrão de
fábrica (`FRAMEWORK.md` §4).

## Princípio (por que é mecanismo no plugin)

- Vault de operador é um **tipo** de sub-vault; esta é a fábrica desse tipo
  (convenção `cnct-fabrica-<tipo>`).
- A **espinha** (protocolo de sessão, regra de escrita, calibração, check de
  atualizações, "antes de tocar código") já é provida pelo mecanismo em
  `config/protocolo-mecanismo.md` e injetada pelo hook. A fábrica materializa **só o
  delta** do operador — **nunca** reescreve a espinha
  (`GLOSSARIO.md#espinha-e-mecanismo`).
- Roda no **estado zero**: instalação nova, sem coletivo, pasta em branco. Por isso é
  **self-contained** — seu knowledge (banco de perguntas, templates) é embutido, não
  depende de ler conhecimento de coletivo (que pode nem existir). Artefato ausente =
  **gatilho de nascimento** (`GLOSSARIO.md#gatilho-de-nascimento`).

## Quando disparar

- `cnct-nucleo-sessao` detecta ausência de vault de operador (`configurar` sem
  `cerebro_pessoal`, ou pasta apontada em branco) → **delega aqui**.
- Operador pede: "criar meu vault", "configurar meu cérebro pessoal", "provisionar operador".
- Operador já provisionado pede a rotina ou o briefing → ir **direto ao Passo 5 / 5b**, sem
  refazer os passos de nascimento.
- **Uma vez por operador.** Se já existe `_cerebro/meu-config.md` no destino, **não
  recriar** — oferecer editar a identidade, a rotina ou o briefing (Passos 5/5b) e sair.

## Protocolo

**Passo 1 — Localizar a pasta destino.**
O **destino padrão é o perfil gerido pelo Connect**: `{CONNECT_HOME}/operador` (decisão
2026-08-17 — ver `CONCEITOS.md` §5). É ele que torna o **vault pessoal Obsidian opcional**:
o mecanismo lê a identidade daí, sem exigir vault do usuário. Resolver `{CONNECT_HOME}` via
`estado_sessao` (campo `home`) e usar `{CONNECT_HOME}/operador` como `{DESTINO}`. Pasta
inexistente é o **caso normal** (estado zero), não erro. No Cowork, **conceder acesso** antes
de escrever.

> Se o operador **também** mantém um vault Obsidian próprio (com protocolos/`CLAUDE.md`
> próprios), ele **coexiste** como enriquecimento opcional — registrado à parte via
> `configurar cerebro_pessoal`, **nunca** como condição do mecanismo. O perfil do operador
> não vive no vault do usuário; vive no CONNECT_HOME.

**Passo 2 — Elicitação mínima (banco destilado do caso-zero).**
Coletar, **uma pergunta por vez**, em linguagem simples — cada pergunta explica em uma
linha *por que importa*:

1. **Nome** do operador. → vira a identidade cross-cliente.
2. **E-mail(s)** — um por contexto/empresa (ex.: e-mail interno; e-mail por cliente). →
   as skills resolvem armadilhas de e-mail por cliente a partir daqui.
3. **Papéis estáveis** (cross-cliente) — ex.: Dev, Tech Lead, Arquiteto. → o papel
   *efetivo* por cliente é resolvido depois, no registro do cliente; aqui é o que você é
   independente de onde.
4. **Já existe um coletivo/matriz?** (a pasta com `_cerebro/vault-config.md`). → se sim,
   pedir caminho + `slug` do cliente para semear o primeiro registro; se não, **seguir** —
   o vault de operador nasce sem coletivo, e o registro de cliente entra depois (via a
   fábrica de cliente / `discovery-intake`).

**Passo 3 — Materializar o scaffold (a forma genérica).**
Criar em `{DESTINO}`, a partir dos **templates desta skill** (`templates/`), interpolando
as respostas. **Garantir cada arquivo no local indicado; se já existe, não sobrescrever —
reportar e pular.**

| Arquivo | Origem | Conteúdo |
|---|---|---|
| `_cerebro/meu-config.md` | `templates/meu-config.template.md` | identidade cross-cliente; `{{DATA_INSTALACAO}}`=hoje, `{{NOME}}`, `{{EMAILS}}`, `{{PAPEIS}}` |
| `CLAUDE.md` | `templates/CLAUDE.template.md` | Camada 0 mínima = **só o delta** (a espinha vem do protocolo-mecanismo) |
| `_cerebro/vinculos/.gitkeep` | — | pasta vazia; **um registro por coletivo** (cliente, tribo, área) entra depois. Schema vigente: `vinculos-v1`. ⚠️ **Nunca** materializar `_cerebro/clientes/` — schema aposentado |
| `_cerebro/memory/MEMORY.md` | inline | `# Memória profunda — {{NOME}}\n\n> Índice. Notas de memória entram aqui, cada uma linkada.` |
| `_cerebro/atualizacoes-aplicadas.md` | inline | cabeçalho do log do check de atualizações + lista vazia |
| `TASKS.md` | inline | a forma da skill de tarefas do `productivity`, **literal e com os cabeçalhos em inglês**: `# Tasks` + `## Active` · `## Waiting On` · `## Someday` · `## Done`, vazias. Forma e deltas do item (tag de coletivo, lastro) em `99 - Templates e Modelos Globais/Template-Briefing-Diario.md` da matriz — não repetir aqui. ⚠️ Até 28/09 nascia `A fazer / Fazendo / Feito`, e as skills que escrevem em `## Active` / `## Waiting On` não achavam a seção |

Se o Passo 2.4 trouxe um coletivo: semear `_cerebro/vinculos/{coletivo}/` com **dois** arquivos, no
schema `vinculos-v1`:

- `config.md` — o vínculo em si: papel efetivo do operador naquele coletivo, e-mail de contexto se
  houver, e a seção **`## Alocações`** — **só ponteiros**: uma linha de lotação (a squad-base) e uma
  por frente em que o operador atua, `| Frente | Hub (ponteiro tipado, no coletivo) |`. Nasce **vazia
  com o cabeçalho**; a fábrica não infere frente nenhuma. Papel, cargo e peso **não** entram: são fato
  do coletivo e se resolvem pela herança de equipe (`modelo-de-celula` § *Herança de equipe* e `R8`
  do `processo-viceri`, na matriz) — copiá-los aqui criaria a segunda fonte que envelhece. É o que o briefing percorre para saber o que é do operador. **Sem path** — o path local
  vive só em `connect.config.json`, gravado por `registrar_subvault_local`, nunca no vault, nem no
  perfil (`GLOSSARIO.md#path-por-maquina`).
- `estado.md` — hot cache do operador naquele coletivo, **com cabeçalho de forma e tabela vazia**:
  uma linha por projeto, uma frase por célula, **substitui e nunca acumula**, fonte de verdade é a nota
  do projeto no coletivo. Quem passa a mantê-lo é o `cnct-nucleo-encerramento` (Passo 4b) — a fábrica
  só o **nasce com a forma certa**.

> **`repos.md` não é criado** — o registro de repositório foi substituído pelo primitivo `resolver_repo`.
> Materializá-lo aqui recria o schema que já foi aposentado.

> ⚠️ **`estado.md` vazio é o estado normal de um vínculo recém-nascido — e é diferente de vínculo com
> dado perdido.** O arquivo declara qual dos dois é, na própria nota de cabeçalho: *"nasceu vazio nesta
> instalação"* × *"a reconciliar"*. A distinção existe porque a confusão entre as duas já custou: em
> 24/08 um `estado.md` nasceu vazio ao lado de uma tabela cheia no acervo legado, e por nove dias
> ninguém soube dizer se faltava dado ou faltava fonte.

**Passo 4 — Registrar o handshake com o mecanismo.**
Sendo o destino `{CONNECT_HOME}/operador`, o mecanismo **já descobre o perfil sozinho** — o
`iniciarSessao` lê `{CONNECT_HOME}/operador` para restaurar identidade + Camada 0 (nenhum
`configurar` necessário para o perfil). Confirmar com `estado_sessao`. Só chamar `configurar
cerebro_pessoal = {VAULT_OBSIDIAN}` se o operador tiver um vault pessoal **próprio** a montar
como enriquecimento (`./pessoal`) — isso é opcional e independente do perfil.

**Passo 5 — Sintonia pessoal do papel (opcional).**
A **definição** de um papel nunca mora no perfil do operador: é do **processo** que o coletivo
declara (no SDD, `_cerebro/metodologias/sdd/papeis/` da matriz), e a ocupação por frente é do
coletivo. O que o perfil pode ter é só a **sintonia pessoal** do papel primário, na forma do
*conciliador* (`_papeis.md` § *Conciliador*, na matriz):

- `_{papel}/rotina.md` — horários, limites por balde do briefing, blocos, o que o briefing nunca traz;
- `_{papel}/papeis-ativos.md` — só se o operador acumula papéis: o primário e o que cada secundário
  acrescenta à rotina dele.

Os dois são **opcionais** — sem eles, valem os padrões do briefing. Oferecer ao operador; se ele
não quiser agora, **não é pendência**. Não existe skill separada de "fábrica de papel": papel que o
processo ainda **não define** é construído pela `cnct-fabrica` genérica, no coletivo, e só se o
operador pedir — nunca a partir desta fábrica, e nunca como aviso de skill ausente.

**Passo 5b — Briefing diário (opcional, vale também para operador que já existe).**
Dispara aqui ou quando um operador já provisionado pede *"criar meu briefing"*, *"agendar o
briefing diário"*, *"quero o review de sexta"*. A **lógica** do briefing é da matriz
(`99 - Templates e Modelos Globais/Template-Briefing-Diario.md`); a tarefa agendada é **gatilho
fino** e nunca carrega lógica, para não envelhecer contra a forma.

1. **Pré-requisitos, conferidos antes de criar:** `TASKS.md` na forma da Parte 1 do template;
   vínculos com `## Alocações` preenchida (sem alocação o briefing não tem o que ler — ajudar o
   operador a declarar as frentes, **só ponteiros**); rotina do papel primário, se ele quiser
   sintonia (Passo 5). Falta de rotina **não** bloqueia.
2. **Ler a Parte 5 do template na matriz** e usar o prompt **dela, verbatim**, trocando só
   `{papel}` pela pasta do papel primário e a variante (`diária` × `de sexta`). Nunca redigir outro
   prompt, nunca mandar a tarefa ler pasta ou projeto inteiro, nunca embutir baldes ou limites.
3. **Criar com a ferramenta de tarefa agendada da plataforma**, carregando-a se estiver diferida.
   Horário vem da rotina (sem rotina: perguntar). ⚠️ A tarefa tem de nascer **no projeto Cowork que
   tem as pastas do Connect conectadas** — criada fora dele, roda sem matriz nem operador ao alcance.
   Se a ferramenta não estiver disponível ou a sessão não estiver nesse projeto, **dizer exatamente
   isso** ao operador e entregar o prompt da Parte 5 para ele criar pela interface — nunca
   improvisar um prompt alternativo.
4. **Rodar uma vez na hora** (ou pedir ao operador que dispare) e conferir que o briefing saiu
   lendo os vínculos — é o teste de que as alocações estão certas.

**Passo 6 — Operador que já existe: migrar com inventário, nunca sobrescrever.**
Esta fábrica **nasce** um operador; quando o destino já tem perfil, ela não recria — mas também **não
pode simplesmente parar**, porque foi assim que 4 convenções com gatilho se perderam em 24/08 (regra de
empacotamento de skill, projetos exemplo, limpeza em reestruturação de vault, destino de artefato — uma
delas declarada *"genuinamente pessoal, sem equivalente no coletivo"*, ou seja, irrecuperável se a fonte
fosse podada). Protocolo:

1. **Inventariar a origem** — se o operador tinha cérebro pessoal anterior (`CLAUDE.md` raiz e
   `_cerebro/CLAUDE.md`), listar toda seção com **gatilho declarado** ("ao empacotar…", "quando eu
   disser…", "antes de salvar…").
2. **Diff explícito** contra o perfil atual, apresentado ao operador — o que existe nos dois, o que só
   existe na origem, o que só existe no perfil.
3. **Nada é descartado em silêncio.** O que só existe na origem é ou migrado, ou declarado como
   deliberadamente aposentado, com a razão. Ausência de decisão não vira remoção.
4. **Nunca podar a origem** antes de o diff estar zerado e confirmado pelo operador.

## Regras

- **Nunca hardcodar cliente** nem assumir `mapfre`/`viceri` — tudo vem da elicitação.
- **Nunca reescrever a espinha** no `CLAUDE.md` do operador — é mecanismo. O
  `CLAUDE.md` do operador é **só delta**.
- **Dado pessoal fica no vault do operador**, nunca no plugin. Os templates são forma vazia.
- **Não sobrescrever** arquivo existente — a fábrica **nasce**, não migra à força (migrar a
  instância de um operador já existente é dogfooding, feito à parte).
- **Wikilinks e regra de escrita** valem para o que a fábrica cria: linkar
  `meu-config` ↔ `CLAUDE.md` ↔ `MEMORY.md` (sem sinapse morta).

## Supersede

- `Template-Onboarding-Vault-Individual` do coletivo → **superado por esta
  fábrica genérica**: a versão do coletivo era a instância Viceri; a forma sobe para
  o produto.

<!-- SKILL-END cnct-fabrica-operador v0.2.0 · L2 · ref. FRAMEWORK.md §4 -->
