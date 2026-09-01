---
name: cnct-fabrica-operador
description: >
  Provisiona do ZERO, por elicitação, um vault de operador do dois-cérebros
  (identidade cross-cliente + delta de comportamento), materializando a forma
  genérica que o produto entrega. Dispara quando: instalação sem cérebro pessoal,
  operador aponta uma pasta em branco, pedidos como "criar meu vault", "configurar
  meu cérebro pessoal", "provisionar operador", ou quando o cnct-nucleo-sessao
  detecta ausência de vault de operador e delega. Convenção cnct-fabrica-<tipo>: esta é
  a fábrica do tipo "operador" (implementação de referência do padrão em FRAMEWORK.md).
  Roda no estado zero — não exige coletivo montado. Estado zero é gatilho de
  nascimento, não erro (D97/D105).
metadata:
  version: "0.3.0"
  eixo: nucleo
  program: "Impulsa / Viceri"
  camada: "L2 — fábrica por tipo"
---

# Connect — fábrica de vault de operador

Instruções para o Claude. Objetivo: **nascer** um vault de operador completo por
elicitação, sem exigir coletivo montado. Implementação de referência do padrão de
fábrica (`FRAMEWORK.md` §4).

## Princípio (por que é mecanismo no plugin)

- Vault de operador é um **tipo** de sub-vault (D101); esta é a fábrica desse tipo
  (convenção `cnct-fabrica-<tipo>`).
- A **espinha** (protocolo de sessão, regra de escrita, calibração, check de
  atualizações, "antes de tocar código") já é provida pelo mecanismo em
  `config/protocolo-mecanismo.md` e injetada pelo hook. A fábrica materializa **só o
  delta** do operador — **nunca** reescreve a espinha (D104).
- Roda no **estado zero**: instalação nova, sem coletivo, pasta em branco. Por isso é
  **self-contained** — seu knowledge (banco de perguntas, templates) é embutido, não
  depende de ler conhecimento de coletivo (que pode nem existir). Artefato ausente =
  **gatilho de nascimento** (D97).

## Quando disparar

- `cnct-nucleo-sessao` detecta ausência de vault de operador (`configurar` sem
  `cerebro_pessoal`, ou pasta apontada em branco) → **delega aqui**.
- Operador pede: "criar meu vault", "configurar meu cérebro pessoal", "provisionar operador".
- **Uma vez por operador.** Se já existe `_cerebro/meu-config.md` no destino, **não
  recriar** — oferecer editar a identidade e sair.

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
   fábrica de cliente / `demand-intake`).

**Passo 3 — Materializar o scaffold (a forma genérica).**
Criar em `{DESTINO}`, a partir dos **templates desta skill** (`templates/`), interpolando
as respostas. **Garantir cada arquivo no local indicado; se já existe, não sobrescrever —
reportar e pular.**

| Arquivo | Origem | Conteúdo |
|---|---|---|
| `_cerebro/meu-config.md` | `templates/meu-config.template.md` | identidade cross-cliente; `{{DATA_INSTALACAO}}`=hoje, `{{NOME}}`, `{{EMAILS}}`, `{{PAPEIS}}` |
| `CLAUDE.md` | `templates/CLAUDE.template.md` | Camada 0 mínima = **só o delta** (a espinha vem do protocolo-mecanismo) |
| `_cerebro/vinculos/.gitkeep` | — | pasta vazia; **um registro por coletivo** (cliente, tribo, área) entra depois. Schema vigente: `vinculos-v1` (CA6–CA9 da `CONNECT-E2-01`, emenda 18/08). ⚠️ **Nunca** materializar `_cerebro/clientes/` — schema aposentado |
| `_cerebro/memory/MEMORY.md` | inline | `# Memória profunda — {{NOME}}\n\n> Índice. Notas de memória entram aqui, cada uma linkada.` |
| `_cerebro/atualizacoes-aplicadas.md` | inline | cabeçalho do log do check de atualizações + lista vazia |
| `TASKS.md` | inline | `# TASKS — {{NOME}}` + colunas kanban vazias (A fazer / Fazendo / Feito) |

Se o Passo 2.4 trouxe um coletivo: semear `_cerebro/vinculos/{coletivo}/` com **dois** arquivos, no
schema `vinculos-v1`:

- `config.md` — o vínculo em si: papel efetivo do operador naquele coletivo, e-mail de contexto se
  houver. **Sem path** (D35: o path local vive só em `connect.config.json`, gravado por
  `registrar_subvault_local` — nunca no vault, nem no perfil).
- `estado.md` — hot cache do operador naquele coletivo, **com cabeçalho de forma e tabela vazia**:
  uma linha por projeto, uma frase por célula, **substitui e nunca acumula**, fonte de verdade é a nota
  do projeto no coletivo. Quem passa a mantê-lo é o `cnct-nucleo-encerramento` (Passo 4b) — a fábrica
  só o **nasce com a forma certa**.

> **`repos.md` não é criado** — o registro de repositório foi substituído pelo primitivo `resolver_repo`
> (P64/D127). Materializá-lo aqui recria o schema que já foi aposentado.

> ⚠️ **`estado.md` vazio é o estado normal de um vínculo recém-nascido — e é diferente de vínculo com
> dado perdido.** O arquivo declara qual dos dois é, na própria nota de cabeçalho: *"nasceu vazio nesta
> instalação"* × *"a reconciliar"*. A distinção existe porque a confusão entre as duas já custou: em
> 24/08 um `estado.md` nasceu vazio ao lado de uma tabela cheia no acervo legado, e por nove dias
> ninguém soube dizer se faltava dado ou faltava fonte (P117/P119).

**Passo 4 — Registrar o handshake com o mecanismo.**
Sendo o destino `{CONNECT_HOME}/operador`, o mecanismo **já descobre o perfil sozinho** — o
`iniciarSessao` lê `{CONNECT_HOME}/operador` para restaurar identidade + Camada 0 (nenhum
`configurar` necessário para o perfil). Confirmar com `estado_sessao`. Só chamar `configurar
cerebro_pessoal = {VAULT_OBSIDIAN}` se o operador tiver um vault pessoal **próprio** a montar
como enriquecimento (`./pessoal`) — isso é opcional e independente do perfil.

**Passo 5 — Moldagem de papel (delegar).**
Para cada papel estável coletado, a **moldagem de papel** materializa a estrutura mínima
daquele papel no vault. Isso é da skill-irmã **`cnct-fabrica-papel`** (framework de papéis) — nome
corrigido em 24/08: era citado como `fabrica-papel`, que **não existe e viola a convenção de nome**
(`cnct-` é do produto, e "papel" é conceito do produto — ADR-15/D174).
Enquanto ela não existe, registrar os papéis em `meu-config.md` (já feito no Passo 3) e
**deixar a pendência nomeada** ao operador — não embutir a moldagem aqui.

**Passo 6 — Operador que já existe: migrar com inventário, nunca sobrescrever (P119).**
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
- **Nunca reescrever a espinha** no `CLAUDE.md` do operador — é mecanismo (D104). O
  `CLAUDE.md` do operador é **só delta**.
- **Dado pessoal fica no vault do operador**, nunca no plugin. Os templates são forma vazia.
- **Não sobrescrever** arquivo existente — a fábrica **nasce**, não migra à força (migrar a
  instância de um operador já existente é dogfooding, feito à parte).
- **Wikilinks e regra de escrita** valem para o que a fábrica cria: linkar
  `meu-config` ↔ `CLAUDE.md` ↔ `MEMORY.md` (sem sinapse morta).

## Supersede

- `Template-Onboarding-Vault-Individual` do coletivo (D27/D70) → **superado por esta
  fábrica genérica** (D105): a versão do coletivo era a instância Viceri; a forma sobe para
  o produto.

<!-- SKILL-END cnct-fabrica-operador v0.2.0 · L2 · ref. FRAMEWORK.md §4 -->
