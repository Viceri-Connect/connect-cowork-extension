# Connect — Contrato de Tipos (o que a fábrica constrói)

> O terceiro contrato do produto, ao lado do [contrato de manifesto](./contrato-manifesto.md)
> (a **fronteira**: esta entidade existe, quem governa, o acervo é externo?) e do
> [contrato de navegação](./contrato-navegacao.md) (o **interior**: montei o acervo, por onde
> entro?). Este responde a pergunta que vem antes das duas: **"isto ainda não existe — o que
> precisa nascer, e como o mecanismo passa a enxergar o que nasceu?"**
>
> Mecanismo, entregue e mantido pelo produto (corte `_`/conteúdo, D96): o Connect declara a
> **exigência** — o que um tipo precisa declarar para ser construível. A empresa responde o
> **como** — quais tipos existem e qual a estrutura mínima de cada um, no
> `_cerebro/modelo-roteamento.md` § *Estrutura mínima e herança* da sua matriz. O produto não
> prescreve a lista de tipos (D98).
>
> Versão 0.1.0 · 2026-08-25 · Impulsa / Viceri

---

## 1. O problema que este contrato fecha

A `cnct-fabrica` é **uma** mente construtora, com o tipo vindo do knowledge (D186) — não uma
skill por tipo. Em 25/08 o lado do coletivo ficou pronto (D204): a estrutura mínima por destino e
as semânticas de descida passaram a viver no `modelo-roteamento`, estendendo o contrato que já
governa a escrita, em vez de ganhar catálogo próprio. **Faltava a metade do produto** — e a
ausência tem três consequências medidas:

1. **"Tipo" era palavra-ônibus.** `processo`, `tribo`, `glossario` e `operador` entraram na mesma
   lista no desenho original e **não são a mesma coisa** — dois deles são o que o roteamento
   roteia, dois são *onde* ele se aplica. Sem o eixo declarado, a fábrica não sabe o que está
   construindo, logo não sabe o que verificar ao terminar.
2. **A fábrica não sabia quando tinha terminado.** Materializar arquivo é o passo fácil; o passo
   que ninguém declarou é o **handshake** — o que faz `resolver` passar a devolver `resolvido`
   para o que acabou de nascer. Sem ele, a fábrica produz, por construção, exatamente a classe de
   defeito que o contrato de navegação §5 check 6 chama de **nota órfã**: existe em disco, e
   nenhum ponteiro declarado a alcança.
3. **O estado zero era exceção descoberta, não regra com teste.** A `cnct-fabrica-operador` roda
   **antes** de existir qualquer coletivo — logo, antes de existir roteamento para ler. Isso
   aparecia como caso especial no meio do desenho, e caso especial não descrito é caso especial
   que reaparece.

> **Por que não vira catálogo do produto.** Um catálogo próprio permitiria à fábrica **ignorar o
> que a matriz já declara** — e o viés medido do construtor é criar, porque artefato novo é
> visível e reuso não é (D204, caso-zero de 25/08: três peças propostas, três já existiam sob
> outro nome). Lendo o roteamento do coletivo alvo, ela não consegue ignorar. Este contrato
> declara o **schema** e o **handshake**; a lista de tipos nunca mora aqui.

---

## 2. Onde um tipo é declarado

| | Caso geral | Exceção do estado zero |
|---|---|---|
| Onde mora | `_cerebro/modelo-roteamento.md` § *Estrutura mínima e herança*, **na matriz do coletivo alvo** | `config/tipos/{tipo}.md`, **neste plugin** |
| Quem escreve | quem governa aquele coletivo | o produto |
| Quando se aplica | todo tipo cujo nascimento pressupõe um coletivo montado | tipo cujo nascimento **precede a existência de qualquer coletivo** |
| Hoje qualifica | todos os demais | **exatamente um**: `operador` |
| Ausência | lacuna reportada → elicitação com o operador (D97) | defeito do produto, não do coletivo |

**O teste que decide, e é objetivo:** *para construir este tipo, a fábrica precisa ler alguma
declaração do coletivo?* Se sim, o tipo é do coletivo. Se a resposta for "não há coletivo ainda",
é estado zero. Não há terceiro caso, e a lista de estado zero **não cresce por conveniência** —
cresce só quando um tipo novo passa nesse teste.

> ⚠️ **Consequência declarada sobre o `FRAMEWORK.md` §3.** As camadas L2 (*"uma fábrica por tipo
> declarado pelo produto"*) e L3 (`cnct-fabrica-tipos`) descrevem o desenho plural que a **D186**
> fechou. Este contrato o substitui: há **uma** fábrica, e "criar um tipo novo" deixa de ser skill
> meta e passa a ser **preencher as células deste schema** no roteamento do coletivo. A §3 do
> FRAMEWORK está em dívida de atualização — declarado aqui para não voltar por esquecimento.

---

## 3. O que um tipo declara — o schema

Seis campos. A ausência de qualquer um é **tipo não construível**: a fábrica recusa e nomeia o
campo faltante, nunca supre por conta própria.

| # | Campo | O que declara | Por que é obrigatório |
|---|---|---|---|
| 1 | **nome** | o termo pelo qual o operador o chama (`processo`, `tribo`, `glossario`) | é a chave de casamento; sem ele o gatilho da conversa não alcança o tipo |
| 2 | **família** | `artefato` ou `contexto` (§4) | é o que **deduz o modo** de construção — nunca se pergunta ao operador |
| 3 | **estrutura mínima** | o que precisa existir para um destino daquele tipo ser válido | é o que a fábrica **garante** e o que o audit **verifica**; sem isso "nasceu certo?" não tem resposta |
| 4 | **semântica de descida** | `delta` · `exigência-e-resposta` · `não desce` | confundi-las é erro de modelagem: uma pede raiz única, a outra pede obrigação de resposta por unidade |
| 5 | **forma canônica** | **ponteiro** para o template do coletivo (`99 - Templates e Modelos Globais/`), nunca molde embutido | scaffold aponta, nunca copia (D200) — molde próprio é a terceira cópia da mesma forma |
| 6 | **handshake** | o que fecha o nascimento (§5) | é o que distingue *materializado* de *alcançável*; sem ele a fábrica gera órfão |

> **O que o schema deliberadamente NÃO tem: um campo de "modo".** O modo se deduz da família
> (campo 2). Perguntar ao operador *"isto é artefato ou contexto?"* seria transferir a ele uma
> classificação do mecanismo — e é a pergunta que ninguém de fora do produto sabe responder.

---

## 4. As duas famílias — e por que o eixo é este

| Família | O que é | A pergunta que responde | Estrutura mínima é |
|---|---|---|---|
| **Tipo de artefato** | o que o roteamento **roteia** — vive *dentro* de um contexto | *"onde este item vai morar?"* | pasta + hub com nome semântico + forma de capa + `estado:` declarado |
| **Tipo de contexto** | **onde** o roteamento se aplica — o container | *"que casa precisa existir para itens caírem nela?"* | carta de navegação + `_cerebro/vault-config.md` + a árvore que o roteamento pressupõe |

Exemplos vivos desta instância: `processo`, `glossario`, `identificador`, `politica`, `ADR`,
`navegacao` são **artefato**; `tribo`, `cliente`, `projeto`, `operador` são **contexto**.

**Relação com os eixos que já existem** (conceituação completa no acervo da tribo Impulsa,
`projetos/Connect/formas-e-tipos-de-vault.md` §2.1–2.2 — resolver o conceito `impulsa`):

- `tipo`/`papel` descrevem a **entidade** e são declarados pela empresa, no manifesto.
- **forma** (`matriz` · `sub-vault` · `operador`) é do produto e vive no `vault-config.md` do
  próprio vault.
- **família** é este terceiro eixo. Todo *tipo de contexto* tem uma forma de vault; *tipo de
  artefato* é ortogonal a forma — um `processo` existe dentro de uma matriz e dentro de um
  sub-vault, com a mesma estrutura mínima e semânticas de descida diferentes.

---

## 5. O handshake de materialização — o primitivo que faltava

> **A fábrica não termina quando escreve o último arquivo. Termina quando o mecanismo resolve o
> que ela criou.** Esta é a metade que só o produto pode declarar, porque só o produto sabe o que
> o `resolver` precisa encontrar.

### 5.1 Família `contexto` — três passos, nesta ordem

| # | Passo | Sem ele |
|---|---|---|
| 1 | **Manifesto na matriz** — nota da entidade com `tipo`/`papel`/`externo`, e a aresta declarada **nos dois lados** | `resolver` devolve `origem-ausente`: o acervo existe e o grafo não o declara |
| 2 | **`registrar_subvault_local(conceito, path)`** — o path mora só em `connect.config.json`, nunca no vault (D35) | `resolver` devolve `local-nao-configurado` a cada máquina nova |
| 3 | **Carta de navegação** (`_cerebro/camada-1.md`, 5 seções do contrato de navegação) + `_cerebro/vault-config.md` com `tipo-vault` | monta e o agente não sabe navegar — a lacuna que a `cnct-fabrica-navegacao` existe para fechar |

**Verificação de fechamento, não opcional:** a fábrica chama `resolver(conceito)` ao terminar e
**exige `status: resolvido` com zero avisos**. Qualquer outro status é nascimento incompleto,
reportado ao operador com o passo que faltou — nunca declarado pronto na expectativa de que
alguém complete depois.

### 5.2 Família `artefato` — dois passos

| # | Passo | Sem ele |
|---|---|---|
| 1 | **Estrutura mínima materializada** no destino que o roteamento declara (pasta + hub semântico + capa + `estado:`) | o item cai em destino inválido, e a escrita passa a criar pasta por conta própria |
| 2 | **Linha na tabela `## Quando carregar`** da carta de navegação daquele vault, ligando o gatilho ao hub | **nasce órfão**: existe, e nenhum ponteiro declarado o alcança |

**O passo 2 é o que este contrato acrescenta e nada declarava.** Um artefato materializado sem
gatilho é encontrável só por varredura — e uma nota que só o `grep` acha é, por definição, uma
nota que a curadoria perdeu. A fábrica que não escreve a linha do gatilho **produz o defeito que
o audit vai reportar depois**, o que é pior do que não construir: cria trabalho e esconde a causa.

### 5.3 Regra comum às duas famílias

- **Nunca sobrescrever.** Estrutura existente é completada **por delta**; o que já está lá é
  fonte, não rascunho. Ausência é gatilho de nascimento (D97); presença é gatilho de conferência.
- **Nascimento é atômico do ponto de vista do operador.** Se um passo do handshake falha, a
  fábrica reporta o estado parcial nomeando o que ficou pendente — jamais silencia.
- **Todo contexto que nasce a partir de 24/08 declara `tipo-vault`.** A ausência passa a ser sinal
  de vault a migrar, não de vault sem forma.

---

## 6. Invariantes

- **O produto declara a exigência; o coletivo declara os tipos.** A lista de tipos nunca mora
  neste plugin — exceto os do estado zero (§2), que são exceção declarada e testável, não aberta.
- **O modo se deduz do tipo, nunca se pergunta.** Pergunta de classificação de mecanismo dirigida
  ao operador é defeito de desenho.
- **Scaffold aponta, nunca copia** (D200). A forma canônica vive nos templates do coletivo.
- **Antes de declarar um tipo, procurar a casa que já governa aquilo.** Corolário do construtor
  sem arquiteto (D186/D204): o viés do agente é criar; o do produto tem de ser resolver.
- **Materializado ≠ alcançável.** Nenhuma construção é declarada completa sem o handshake (§5).
- **A fábrica lê o roteamento do coletivo alvo em runtime** — não guarda cópia local do que a
  matriz declara. Cópia local desatualizada é o modo de falha mais observado (D34/D35).

---

## 7. Face de verificação

Par exigência → resposta → verificação (D29/D30/D99). **Estado honesto de cada check** —
mecanismo (o plugin garante) × pendente (hoje depende de disciplina, e por isso não é garantia):

| # | Check | Estado |
|---|---|---|
| 1 | Todo tipo invocado tem os 6 campos do schema (§3) declarados na fonte | **pendente** — depende do executor da `cnct-fabrica` (P124) |
| 2 | A família é declarada, e o modo nunca é perguntado ao operador | **pendente** — idem |
| 3 | Contexto criado devolve `resolver → resolvido` com zero avisos (§5.1) | **pendente** — o primitivo existe (`resolver`); falta quem o chame como gate |
| 4 | Artefato criado tem linha de gatilho na carta do vault (§5.2) | **pendente** — é o check que hoje ninguém faz |
| 5 | Nada é sobrescrito; estrutura existente é completada por delta | **pendente** |
| 6 | Estrutura mínima existe antes de a escrita rotear item para o destino | **pendente** — `cnct-nucleo-escrita` deve **recusar** destino sem estrutura, em vez de criar pasta |

> **Seis pendentes e nenhum mecanismo — e isso é o estado honesto, não uma omissão.** Este
> contrato é a **especificação** que faltava; o executor é a **P124**, que ele desbloqueia. A
> distância entre contrato e garantia é exatamente a família de defeito D104/D152/D157/D168/D181/
> D190: *a norma existe, o executor não*. Declará-la aqui é o que impede a sexta ocorrência de
> virar a sétima em silêncio.

---

## 8. Exemplo (genérico) — como um tipo se declara no coletivo

```markdown
| Destino | Estrutura mínima que a fábrica garante | Semântica de descida |
|---|---|---|
| `_cerebro/metodologias/` | raiz do processo com inegociáveis identificados (prefixo + numeração
  declarada) + índice; delta por contexto em arquivo próprio | **delta** |
```

Lido pela fábrica como:

| Campo | Valor derivado |
|---|---|
| nome | `processo` |
| família | `artefato` (vive dentro de um contexto) |
| estrutura mínima | raiz com inegociáveis identificados + índice + delta por contexto |
| semântica de descida | `delta` — **uma** raiz; mais de uma para o mesmo escopo é defeito |
| forma canônica | `99 - Templates e Modelos Globais/` (resolver o template lá) |
| handshake | §5.2 — materializar + escrever a linha de gatilho na carta do vault |

---

> Fontes de decisão: D96 (corte `_`/conteúdo), D97 (ausência = nascimento), D98 (produto hospeda,
> não prescreve), D186 (fábrica única, o tipo vem do knowledge), D199 (duas famílias, o modo se
> deduz), D200 (scaffold aponta; estado zero é regra com teste), D204 (o contrato da fábrica é o
> `modelo-roteamento` estendido), ADR-6 (token-efficiency lazy), ADR-15 (namespace de origem).
> Pendências: fecha **P134**; desbloqueia **P124** (especificação do executor). Irmã: **P115**
> (`contrato-skill.md`, também citado por convenção vigente e nunca materializado).
