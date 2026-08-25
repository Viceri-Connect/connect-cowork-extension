# Connect — Framework do Catálogo de Skills

> Padrão único ao qual toda skill do Connect adere. Ancorado no plugin (mecanismo, não
> conteúdo da empresa — corte `_`/conteúdo, D96). Se uma skill não cabe neste padrão, o
> defeito é da skill, não do padrão — parar e nomear antes de mexer.
>
> Versão 0.2.0 · 2026-08-15, revisto em 2026-08-24 · Impulsa / Viceri
>
> **Revisão de 24/08 (ADR-15/D174–D178):** nasce a §3.2 (namespace de origem — quem emite o nome),
> `metadata.eixo` passa a ser obrigatório, a L3 ganha a responsabilidade de explodir processo em skill,
> aparece a linha "fora das camadas" para fábrica cujo contrato é da empresa, e §5/§5.4/§6 são
> atualizadas contra a auditoria das 6 skills. Origem da revisão: auditoria que achou 10 defeitos, dois
> deles degradando o mecanismo em silêncio (P117, `cnct-fabrica-operador` no schema antigo).

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
| **L1 · Primitivos** | mount + manifesto + acervo; restauração de contexto; escrita governada; encerramento; auditoria do vault. Agnóstico de tipo | `iniciar_sessao`, `resolver`, `mount_junction`, `cnct-nucleo-sessao`, `cnct-nucleo-escrita`, `cnct-nucleo-encerramento`, `cnct-nucleo-audit` | mecanismo, universal |
| **L2 · Fábricas por tipo** (`cnct-fabrica-<tipo>`) | Uma por **tipo declarado pelo produto**: `operador`, `navegacao`, `papel`. Cada uma sabe **entrevistar** e **materializar** o seu tipo | `cnct-fabrica-operador` (referência), `cnct-fabrica-navegacao` | mecanismo, plural e extensível |
| **L3 · Meta** | Criação/edição de **templates** para tipos que ainda não existem — a empresa cria o seu modelo sem esperar release. É também a camada que **explode processo em skill** sob demanda com o operador | `cnct-fabrica-tipos` *(a especificar — declarada desde 15/08)* | mecanismo |
| **Fora das camadas · fábricas do coletivo** | Fábricas cujo **contrato é da empresa** — tribo, cliente, projeto, processo. Canônicas na matriz, entregues pelo plugin, **sem prefixo `cnct-`** (§3.2) | fábrica de tribo/cliente *(a especificar — P79; o vault da Tribo MAPFRE, criado à mão em 24/08, é o caso-zero dela)* | conteúdo da empresa |

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

### 3.2 Quem emite o nome — o namespace é de ORIGEM, nunca de assunto

> Ratificado em 2026-08-24 — **ADR-15** (acervo da tribo Impulsa, `projetos/Connect/adr/`; resolver o
> conceito `impulsa`). A §3.1 resolvia o inventário existente e deixava aberto o caso que este framework
> passou a prometer na L3: **quem assina o nome quando uma fábrica cria skill nova**.

O prefixo declara **quem detém o contrato e responde pela versão canônica** — porque é isso que o
entregador de skill precisa saber para decidir o que entregar. Três regras, sem exceção:

1. **`cnct-` é reservado ao produto.** Só recebe o prefixo a skill cujo contrato é declarado em
   `config/contrato-*.md`, que roda em qualquer instância (inclusive no estado zero) e cuja versão
   canônica é a do plugin.
2. **Fábrica segue a regra.** `cnct-fabrica-<tipo>` existe só quando o **tipo** é conceito do produto —
   hoje `operador`, `navegacao`, `tipos`, `papel`. Fábrica que precisa de conhecimento do coletivo para
   executar (tribo, cliente, projeto, processo) **não** é `cnct-`: não existe "tipo tribo" no produto,
   existe "tribo" na empresa que a declarou. ⚠️ Consequência direta: o exemplo `cnct-fabrica-tribo`
   citado na §3.1 **é nome inválido** — a fábrica de tribo é do coletivo.
3. **Nenhuma fábrica emite nome no namespace do produto.** Artefato-skill gerado por fábrica nasce com
   nome de domínio. Emitir `cnct-*` seria assinar, em nome do produto, contrato que o produto não
   escreveu. Emissor e emitido ficam em namespaces distintos — é isso que remove a contradição da L3.

**Eixo de trabalho é dado, não nome.** A classificação (`nucleo`, `processo-sdd`, `processo-corporativo`,
`dogfooding`, …) vive em `metadata.eixo` no frontmatter — obrigatório em toda skill deste catálogo.
Prefixo de assunto (`sdd-*`, `corp-*`) foi considerado e descartado: aposta que o eixo não muda, e
`elicitacao-captura` mudou de eixo em 24/08 (ver §5.4). A **lista** de eixos vigentes é conteúdo da
empresa e mora em `_inteligencia/convencao-skills.md` da matriz, nunca aqui.

> **Conformidade medida em 24/08:** 5 das 6 skills declaravam `metadata.version`; `cnct-fabrica-navegacao`
> não declarava `metadata` nenhum — sem versão, o comparador não tem o que comparar. Corrigido, e a
> exigência passa a ser do `contrato-skill.md` (a escrever — P115).

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

> ⚠️ **Nomes atualizados em 24/08** — as três primeiras linhas citavam nomes pré-`cnct-`, absorvidos:
> `vault-write` → `cnct-nucleo-escrita` · `session-close` → `cnct-nucleo-encerramento` ·
> `vault-audit` → `cnct-nucleo-audit`. As duas primeiras continuavam **instaladas em paralelo**,
> declarando as mesmas frases de gatilho palavra por palavra — daí o *"o encerramento às vezes não
> dispara"* (P113). Enquanto o **entregador** não existir (P114), a desinstalação é ato manual do
> operador: decisão registrada em vault não alcança inventário instalado.

| Skill | Escreve em | Nota |
|---|---|---|
| `cnct-nucleo-escrita` | protocolo; contrato na matriz, taxonomia em `_inteligencia/skills/{skill}/` do vault alvo | mecanismo com regras da empresa |
| `cnct-nucleo-audit` | `_automacoes/` (mecanismo); lê `criterios-customizados.md` (conteúdo) | mesmo padrão; é o produto se auditando, não a squad entregando |
| `cnct-nucleo-encerramento` | orquestra escritas por vault; escreve **direto** só no perfil do operador (`TASKS.md` + `vinculos/{coletivo}/estado.md`) | orquestrador. O Passo 4b nasceu de defeito medido: o estado do vínculo não tinha quem escrevesse (P117) |
| `elicitacao-captura` | `_inteligencia/`/caso-zero | ~~candidata a split~~ → **eixo próprio `dogfooding`** (24/08, D177). Ver §5.4 |
| `tasks-sync` | `tasks.md` master (conteúdo) — executor genérico | conteúdo da empresa, eixo `processo-sdd` |

### 5.3 Conteúdo da empresa (processo SDD · knowledge no coletivo, produz em pasta sem `_`)

`discovery-intake` · `discovery-doc` · `daily-ingest` · `refinement-technical` ·
`refinement-architecture` · `planning-sdd` · `spec-openspec` · `apf-orcamento` ·
`lei-do-bem` — todas escrevem em `projetos/`, Delivery Hub ou repo (conteúdo). Executor é
mecanismo genérico (convenção-skills), mas a **skill como entrada de catálogo é da empresa**:
seu knowledge vive no coletivo e viaja com o coletivo, não com o plugin.

### 5.4 `elicitacao-captura` — de "candidata a split" a eixo próprio (D177, 24/08)

O **mecanismo** de captura passiva (sinais, MODOs A/B/C, o eixo *atrito de dogfooding*) é do
produto; o **capturado** (o caso-zero da empresa) é conteúdo. A leitura de 15/08 concluiu daí que a
skill deveria ser **partida** — e é uma leitura defensável.

**Revisto em 24/08:** ela não é mecanismo nem processo — é **instrumentação de aprendizado sobre o
próprio produto**, com ciclo de vida próprio: *morre quando o caso-zero fechar*. Nem o núcleo nem o
SDD têm essa propriedade. Passa a ter o eixo `dogfooding` (`metadata.eixo`), sem split.

> **E foi essa mudança que decidiu a §3.2.** Uma skill mudou de eixo em nove dias — o que provou, com
> caso real e não hipótese, que prefixo de assunto (`dog-*`) obrigaria a **renomear**, quebrando o
> comparador de versão. Eixo é dado; nome é contrato.

---

## 6. Como adicionar uma skill nova (checklist)

1. Qual **camada** (§3)? Primitivo, fábrica de tipo, meta — ou **fora das camadas**, se o contrato é da
   empresa.
2. Onde ela **escreve** (§2)? Define mecanismo × conteúdo — e onde o knowledge mora.
3. **De quem é o contrato (§3.2)?** É o que decide o **nome**: `cnct-` só se o contrato é do produto.
   Skill gerada por fábrica **nunca** nasce `cnct-`.
4. Declarar `metadata.version` **e** `metadata.eixo`. Sem os dois, o entregador não tem como comparar
   nem classificar — é item de conformidade, não detalhe.
5. Se é fábrica: seguir o **padrão §4** verbatim (elicitar do caso-zero · materializar do
   template · handshake · delegar moldagens · só delta). E, se o destino pode já existir, **passo de
   migração com inventário e diff** — não só de nascimento (P119).
6. Rodar no **estado zero**? Se sim, self-contained.
7. Nunca reescrever a espinha (D104). Nunca sobrescrever artefato existente. **Nunca citar skill-irmã
   sem conferir o nome contra a §3.2** — foi assim que `fabrica-papel` entrou neste catálogo.

---

> Fontes de decisão (nota do projeto no coletivo): D96 (corte `_`/conteúdo), D97 (ausência =
> nascimento), D98 (produto não prescreve, hospeda), D101 (sub-vault tipado + camadas),
> D104 (espinha é mecanismo injetado), D72 (caso-zero como fonte da elicitação). Pendências:
> P58 (taxonomia), P61 (realinhamento do `resolver`).
