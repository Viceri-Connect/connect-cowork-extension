# Connect — Contrato de Manifesto de Entidade

> O contrato mínimo que torna um vault legível por um agente que não conhece a empresa.
> Mecanismo, entregue e mantido pelo **produto** (corte `_`/conteúdo, D96) — o Connect
> declara a **exigência** (quais campos todo manifesto tem); a empresa responde o **como**
> (quais entidades existem e o que preenchem). O produto não prescreve os eixos de conteúdo
> nem a unidade do vault-filho (D98).
>
> Versão 0.1.0 · 2026-08-17 · Impulsa / Viceri

---

## 1. Manifesto × acervo — o mesmo conceito em todos os níveis (D97)

Toda entidade do dois-cérebros — organização, programa, tribo, squad, cliente, produto,
operador — existe como duas partes, e o **corte de camada** decide onde cada uma mora:

| Parte | O que é | Onde mora | Natureza |
|---|---|---|---|
| **Manifesto** | Leve. Declara que a entidade **existe**, quem a governa e onde está a fonte | **Frontmatter da própria nota** da entidade, na matriz | **mecanismo** |
| **Acervo** | Pesado. O conhecimento em si | Na **fonte** da entidade (o SharePoint/OneDrive dela) | **conteúdo da empresa** |

O manifesto mora no frontmatter e **não** em registro separado: registro paralelo cria um
segundo lugar onde a entidade existe — a duplicação que o [[modelo-roteamento]] proíbe na
primeira linha e que D35 condena como cache que apodrece.

**Permissionamento é herdado da fonte, nunca implementado pelo Connect.** Sem acesso à fonte,
o mount falha — e a falha é resposta legítima (*"a entidade existe, você não alcança, procure
quem governa"*), não erro. É o que o produto promete: tornar a ausência visível.

---

## 2. Schema do manifesto (frontmatter)

Campos que todo manifesto declara. `escopo`, `status`, `tags` seguem como já existem.

| Campo | Obrigatório | Semântica | Fonte |
|---|---|---|---|
| `tipo` | **sim** | O que a entidade **é** (`organizacao`, `programa`, `squad`, `cliente`, `produto`, `operador`, …). A empresa declara; o produto não prescreve o conjunto | D98 |
| `papel` | **sim** | Como a entidade **opera** / o que ela hospeda (ex.: `tribo`, `cliente-externo`). Distinto de `tipo`: uma entidade pode ser `tipo: programa` e, ao mesmo tempo, `papel: tribo` | D99.4 |
| `governanca` | **sim** | Quem governa a entidade. É o que transforma a falha de mount de beco sem saída em ação; sem ele, D97 promete transparência e entrega erro | D99.3 |
| `fonte` | **sim (lista)** | Os N acervos da entidade — um por tribo/SharePoint que a atende. Cada item: `{ escopo, url }`. A sessão monta o que o operador alcança | D99.2 |
| `depende-de` | quando houver relação | Arestas do **grafo** (D102): relação declarada para outros vaults. Cada item: `{ alvo, relacao }`. **Bidirecional explícito** — os dois lados declaram a aresta (ver §4) | D102 |

> `fonte` é **lista, não escalar**: uma entidade tem N acervos (D99.2). `fonte: [{escopo, url}]`
> descreve os acervos da *mesma* entidade; multi-cliente é grafo de entidades distintas (§4),
> não `fonte[]`.

---

## 3. Invariantes do contrato

- **Registro autorado é proibido.** Não existe `_cerebro/sub-vaults.json` nem índice de
  entidades escrito à mão. Reintroduziria a duplicação que D97 recusou (P60).
- **O índice de entidades é derivado em runtime.** O `resolver` (e o `cnct-nucleo-sessao`)
  **varre os manifestos** — o frontmatter das notas na matriz — e monta o registro na hora.
  Nada persistido, nada autorado.
- **Manifesto de cliente tem lar fora da árvore organizacional** (D99.1). Cliente é a segunda
  dimensão (D28); se morasse sob um nó da árvore, um cliente atendido por duas tribos teria
  dois manifestos divergentes. Lar canônico: `clientes/{slug}.md` na raiz da matriz.
- **Render/L1 nunca expande acervo** (D103): o bloco de sessão carrega manifesto + ponteiros,
  nunca o conteúdo do acervo — o custo de token fica plano por mais que o grafo cresça (ADR-6).
- **Wikilink cross-acervo é ponteiro tipado resolve-on-touch** (D103): link para conteúdo num
  acervo ainda não montado **não é link morto** — carrega o conceito; navegá-lo dispara o
  `resolver` → mount → resolve. Dentro da matriz o link nunca quebra (todos os manifestos
  moram lá, sempre montada), custo zero.

---

## 4. O grafo de dependências (D102) — arestas bidirecionais

Um vault, em qualquer nível, declara no manifesto uma dependência para outro vault, que o
Connect monta ao resolver. É **grafo e não árvore** porque um mesmo cliente pode ser atendido
por duas tribos (dois pais) — cardinalidade >1 e entidade compartilhada, os dois casos que a
norma de simulação exige e onde uma árvore estrita quebraria.

- **Relação declarada, nunca hardcoded.** `cliente` é tipo filho de `tribo` por convenção da
  instância, não por prescrição do produto ("nada engessado", D102).
- **Bidirecional explícito** (decisão 2026-08-17): os dois manifestos declaram a aresta — a
  tribo declara `{ alvo: cliente/x, relacao: atende }` e o cliente declara
  `{ alvo: tribo/y, relacao: atendido-por }`. Ganha legibilidade isolada; o **preço** é o
  risco de um lado divergir do outro — coberto pela face de verificação (§5).
- **Cardinalidade vem do grafo, não do tipo:** uma tribo com 1 cliente é o caso degenerado
  (n=1); uma tribo com N clientes é n>1. O modelo tem de passar no caso n>1, não só no maduro.

---

## 5. Face de verificação (o que o `vault-audit` passa a checar)

Cada exigência deste contrato tem uma verificação correspondente (par exigência→resposta→
verificação, D29/D30/D99):

1. Todo manifesto tem `tipo`, `papel`, `governanca`, `fonte` (≥1 item).
2. Nenhum `_cerebro/sub-vaults.json` (ou índice autorado equivalente) existe no vault.
3. Manifesto com `tipo: cliente` mora em `clientes/`, fora da árvore organizacional.
4. **Consistência bidirecional do grafo:** para cada aresta `A → B`, existe a inversa
   `B → A` com relação coerente. Aresta órfã (declarada de um lado só) é issue.

---

## 6. Exemplos

```yaml
# organizacao/tribos/tribo-a/tribo-a.md  — tribo (exemplo genérico)
tipo: programa
papel: tribo
governanca: <responsável pela tribo>
fonte:
  - escopo: tribo-a
    url: <acervo da tribo>       # OneDrive/SharePoint; null enquanto não formalizado
depende-de:
  - alvo: cliente/cliente-a
    relacao: atende
```

```yaml
# clientes/cliente-a.md  — cliente, lar fora da árvore; acervo em vault separado
tipo: cliente
papel: cliente-externo
governanca: <responsável pelo cliente>
fonte:
  - escopo: cliente-a
    url: <acervo do cliente>      # vault próprio do cliente (permissão herdada da fonte)
depende-de:
  - alvo: tribo/tribo-a
    relacao: atendido-por
  # um cliente atendido por 2 tribos declara 2 arestas → grafo com dois pais
```

---

> Fontes de decisão (nota do projeto no coletivo): D96 (corte `_`/conteúdo), D97 (manifesto +
> acervo, ausência = ação), D98 (produto não prescreve, hospeda), D99 (lar do cliente, `fonte`
> lista, `governanca` obrigatório, `tipo`≠`papel`), D102 (grafo, não árvore), D103 (acervo
> lazy, ponteiro tipado). Pendências que este contrato desbloqueia: P59/P60/P61 (realinhamento
> do `resolver` ao índice derivado).
