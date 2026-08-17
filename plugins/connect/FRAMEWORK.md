# Connect — Framework do Catálogo de Skills

> Padrão único ao qual toda skill do Connect adere. Ancorado no plugin (mecanismo, não
> conteúdo da empresa — corte `_`/conteúdo, D96). Se uma skill não cabe neste padrão, o
> defeito é da skill, não do padrão — parar e nomear antes de mexer.
>
> Versão 0.1.0 · 2026-08-15 · Impulsa / Viceri

---

## 1. Por que um framework, e não skills soltas

Skill criada caso a caso apodrece: cada uma inventa onde escreve, o que carrega e como
elicita. O catálogo do Connect é **um padrão que se auto-replica** — o produto para de ter
uma resposta canônica por caso e passa a ter um **mecanismo de resposta** (D98 aplicado ao
próprio catálogo). Toda skill nasce encaixada em uma camada (§3) e segue a mesma anatomia
(§2); tipos novos entram pela camada meta (§3, L3) sem esperar release.

---

## 2. Anatomia de uma skill — executor × knowledge (corte D96)

Toda skill tem duas partes, e o **corte de camada** decide onde cada uma mora:

| Parte | O que é | Onde mora | Natureza |
|---|---|---|---|
| **Executor** | O fluxo genérico: passos, elicitação, ordem das operações. Não contém dado de empresa | `plugins/connect/skills/{skill}/SKILL.md` (viaja no plugin) | **mecanismo** |
| **Knowledge** | Sinais, schema, tabelas, critérios — o que a empresa declara e ajusta sem reinstalar | `[coletivo]/_inteligencia/skills/{skill}/{skill}.md` | **conteúdo da empresa** |

**Regra de classificação (não é votação, é varredura):** onde a skill **escreve** decide o
lado. Escreve só em pasta com prefixo `_` (`_cerebro/`, `_inteligencia/`, `_automacoes/`) →
**mecanismo**. Escreve em pasta sem `_` (`projetos/`, `organizacao/`, Delivery Hub) →
**conteúdo**. Escreve nos dois lados → está fazendo duas coisas: **candidata a split**, não a
voto de minerva.

**Corolário — estado zero:** uma skill de mecanismo que precisa rodar **antes de existir
coletivo** (ex.: a fábrica de operador numa instalação nova) é **self-contained**: seu
knowledge é embutido no executor, porque não há coletivo de onde ler. Esse é o único caso em
que knowledge legítimo viaja no plugin.

---

## 3. Camadas do catálogo (D101)

O plugin entrega três camadas; só a terceira é opinativa.

| Camada | O que é | Exemplos | Natureza |
|---|---|---|---|
| **L1 · Primitivos** | mount + manifesto + acervo; restauração de contexto. Agnóstico de tipo | `iniciar_sessao`, `resolver`, `mount_junction`, `cnct-nucleo-sessao`, `cnct-nucleo-conhecimento` | mecanismo, universal |
| **L2 · Fábricas por tipo** (`cnct-fabrica-<tipo>`) | Uma por modelo conhecido de sub-vault: **operador**, tribo, controle pessoal, … Cada uma sabe **entrevistar** e **materializar** o seu tipo | `cnct-fabrica-operador` (referência) | mecanismo, plural e extensível |
| **L3 · Meta** | Criação/edição de **templates** para tipos que ainda não existem — a empresa cria o seu modelo sem esperar release | `cnct-fabrica-tipos` *(a especificar)* | mecanismo |

> A fábrica não constrói o vault — constrói as **fábricas de cada tipo de vault** (D01 num
> nível acima). O produto hospeda a declaração; não prescreve o "como" (D98).

### 3.1 Convenção de nomes — `cnct-<família>-<objeto>`

Toda skill do catálogo Connect (mecanismo) nomeia-se `cnct-<família>-<objeto>`: prefixo
`cnct-` (namespace do produto) · **família** = papel no framework · **objeto** = o que a
skill atua. Nome semântico e em PT — diz a camada e o objeto sem abrir o arquivo.

| Camada | Família | Exemplos |
|---|---|---|
| L1 · primitivos | `nucleo` | `cnct-nucleo-sessao`, `cnct-nucleo-conhecimento` |
| L2 · fábricas por tipo | `fabrica` | `cnct-fabrica-operador`, `cnct-fabrica-tribo` |
| L3 · meta | `fabrica` | `cnct-fabrica-tipos` (a fábrica que cria tipos) |

> Skills de **conteúdo da empresa** (§5.3, família SDD: `discovery-intake`,
> `refinement-technical`, …) **mantêm seus nomes de domínio** — viajam com o coletivo, não
> com o plugin, e ficam fora do namespace `cnct-` do mecanismo.

---

## 4. Padrão de fábrica (`cnct-fabrica-<tipo>`) — o "estilo framework"

Toda skill de L2 segue o mesmo esqueleto. É o contrato que faz o catálogo se auto-replicar:

1. **Localizar destino** — a pasta onde o sub-vault vai morar. Pasta em branco/ausente é o
   **caso normal**, não erro: artefato ausente é gatilho de nascimento (D97). No Cowork,
   conceder acesso à pasta.
2. **Elicitar** — banco de perguntas **destilado do caso-zero** ([[caso-zero]], D72): as
   perguntas que já funcionaram com quem não é arquiteto. Uma por vez, cada uma explicando
   em uma linha *por que importa* (calibração "identificador nunca vem sozinho").
3. **Materializar** — escrever o scaffold a partir dos **templates da própria skill**
   (forma vazia, mecanismo D96), interpolando as respostas. Garantir cada arquivo no local
   indicado; **nunca sobrescrever** o que já existe (a fábrica nasce, não migra à força).
4. **Registrar o handshake** — chamar o primitivo que faz o mecanismo passar a resolver o
   novo sub-vault (`configurar`/`resolver`); confirmar com `estado_sessao`.
5. **Delegar moldagens** — sub-partes tipadas (ex.: papel do operador) são deixadas para a
   skill-irmã de moldagem, não embutidas.

**Invariante:** a fábrica materializa só o **delta**. A espinha do dois-cérebros (protocolo
de sessão, regra de escrita, calibração, check de atualizações) **não** é reescrita por
fábrica nenhuma — ela é mecanismo, provida por `config/protocolo-mecanismo.md` e injetada
pelo hook (D104). Fábrica que reescreve espinha é defeito.

---

## 5. Classificação do catálogo (exemplo — instância de dogfooding)

> **Exemplo, não catálogo do produto.** O que é normativo é o **critério** (§2): onde a skill
> escreve decide mecanismo × conteúdo. A tabela abaixo aplica o critério ao catálogo de **uma
> instância concreta** (o dogfooding) — as skills de conteúdo nomeadas (`discovery-*`,
> `apf-orcamento`, …) são dessa empresa, não do produto. Outra empresa terá outro catálogo de
> conteúdo; só as skills `cnct-*` (mecanismo) viajam no plugin.
> P58 = pendência "taxonomia mecanismo-do-plugin × conteúdo-da-empresa". Confiança **alta**
> onde o destino de escrita é inequívoco; **confirmar** onde a skill escreve nos dois lados.

### 5.1 Mecanismo puro (viaja 100% no plugin)

| Skill | Escreve em | Camada | Confiança |
|---|---|---|---|
| `cnct-nucleo-sessao` | nada (restaura contexto) | L1 | alta |
| `cnct-nucleo-conhecimento` | nada (monta) | L1 | alta |
| `cnct-fabrica-operador` | scaffold do vault-alvo (self-contained, estado zero) | L2 | alta |
| `skill-creator` | fora de vault (utilitário de plataforma) | — (fora do catálogo) | alta |

### 5.2 Mecanismo com knowledge injetável (executor no plugin · knowledge no coletivo)

| Skill | Escreve em | Nota |
|---|---|---|
| `vault-write` | protocolo; knowledge em `_inteligencia/skills/vault-write/` | mecanismo com regras da empresa |
| `vault-audit` | `_automacoes/` (mecanismo); lê `criterios-customizados.md` (conteúdo) | mesmo padrão de `vault-write` |
| `session-close` | orquestra escritas; o mecanismo de consolidação é do produto | orquestrador |
| `elicitacao-captura` | `_inteligencia/`/caso-zero — **candidata a split**: mecanismo de captura (produto) × capturado (empresa) | split declarado; ver §5.4 |
| `tasks-sync` | `tasks.md` master (conteúdo) — executor genérico | confirmar lado |

### 5.3 Conteúdo da empresa (processo SDD · knowledge no coletivo, produz em pasta sem `_`)

`discovery-intake` · `discovery-doc` · `daily-ingest` · `refinement-technical` ·
`refinement-architecture` · `planning-sdd` · `spec-openspec` · `apf-orcamento` ·
`lei-do-bem` — todas escrevem em `projetos/`, Delivery Hub ou repo (conteúdo). Executor é
mecanismo genérico (convenção-skills), mas a **skill como entrada de catálogo é da empresa**:
seu knowledge vive no coletivo e viaja com o coletivo, não com o plugin.

### 5.4 A split de `elicitacao-captura` (o IP do próprio Connect, D02)

O **mecanismo** de captura passiva (sinais, MODOs A/B/C, o eixo *atrito de dogfooding*) é do
produto → candidato a mecanismo no plugin. O **capturado** (o caso-zero da empresa) é conteúdo
→ fica no coletivo. É a evidência mais limpa de que o corte D96 é o certo: ele parte a skill
exatamente na junta natural.

---

## 6. Como adicionar uma skill nova (checklist)

1. Qual **camada** (§3)? Primitivo, fábrica de tipo, ou meta.
2. Onde ela **escreve** (§2)? Define mecanismo × conteúdo — e onde o knowledge mora.
3. Se é fábrica: seguir o **padrão §4** verbatim (elicitar do caso-zero · materializar do
   template · handshake · delegar moldagens · só delta).
4. Rodar no **estado zero**? Se sim, self-contained.
5. Nunca reescrever a espinha (D104). Nunca sobrescrever artefato existente.

---

> Fontes de decisão (nota do projeto no coletivo): D96 (corte `_`/conteúdo), D97 (ausência =
> nascimento), D98 (produto não prescreve, hospeda), D101 (sub-vault tipado + camadas),
> D104 (espinha é mecanismo injetado), D72 (caso-zero como fonte da elicitação). Pendências:
> P58 (taxonomia), P61 (realinhamento do `resolver`).
