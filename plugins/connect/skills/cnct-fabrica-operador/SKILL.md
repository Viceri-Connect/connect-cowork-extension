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
  version: "0.1.0"
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
Perguntar onde o vault de operador vai morar (idealmente uma pasta sincronizada —
OneDrive/Drive — para sobreviver à máquina). Pasta inexistente ou em branco é o **caso
normal** (estado zero), não erro. Guardar como `{DESTINO}`. No Cowork, **conceder
acesso** a essa pasta antes de escrever.

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
| `_cerebro/clientes/.gitkeep` | — | pasta vazia; um registro por cliente entra depois |
| `_cerebro/memory/MEMORY.md` | inline | `# Memória profunda — {{NOME}}\n\n> Índice. Notas de memória entram aqui, cada uma linkada.` |
| `_cerebro/atualizacoes-aplicadas.md` | inline | cabeçalho do log do check de atualizações + lista vazia |
| `TASKS.md` | inline | `# TASKS — {{NOME}}` + colunas kanban vazias (A fazer / Fazendo / Feito) |

Se o Passo 2.4 trouxe um coletivo: semear `_cerebro/clientes/{slug}/config.md` com o
`path-vault-coletivo` informado (forma mínima — paths locais + slug), e deixar
`estado.md`/`repos.md` como stubs vazios.

**Passo 4 — Registrar o handshake com o mecanismo.**
Chamar a tool `configurar` com `cerebro_pessoal = {DESTINO}` para o Connect passar a
resolver este vault. Confirmar com `estado_sessao` (deve reportar `configurado = true`).

**Passo 5 — Moldagem de papel (delegar).**
Para cada papel estável coletado, a **moldagem de papel** materializa a estrutura mínima
daquele papel no vault. Isso é da skill-irmã `fabrica-papel` (framework de papéis).
Enquanto ela não existe, registrar os papéis em `meu-config.md` (já feito no Passo 3) e
**deixar a pendência nomeada** ao operador — não embutir a moldagem aqui.

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

<!-- SKILL-END cnct-fabrica-operador v0.1.0 · L2 · ref. FRAMEWORK.md §4 -->
