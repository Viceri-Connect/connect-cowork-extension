# Connect — Contrato de Manifesto de Entidade

> O contrato mínimo que torna um vault legível por um agente que não conhece a empresa.
> Mecanismo, entregue e mantido pelo **produto** (corte `_`/conteúdo, D96) — o Connect
> declara a **exigência** (quais campos todo manifesto tem); a empresa responde o **como**
> (quais entidades existem e o que preenchem). O produto não prescreve os eixos de conteúdo
> nem a unidade do vault-filho (D98).
>
> Versão 0.2.0 · 2026-08-17 · Impulsa / Viceri

---

## 1. Manifesto × acervo — o mesmo conceito em todos os níveis (D97)

Toda entidade do dois-cérebros — organização, programa, tribo, squad, cliente, produto,
operador — existe como duas partes, e o **corte de camada** decide onde cada uma mora:

| Parte | O que é | Onde mora | Natureza |
|---|---|---|---|
| **Manifesto** | Leve. Declara que a entidade **existe** e quem a governa — nunca *onde* no disco | **Frontmatter da própria nota** da entidade, no lugar natural do organograma (matriz) | **mecanismo** |
| **Acervo** | Pesado. O conhecimento em si | No diretório local que **cada operador** informa (nunca no vault) | **conteúdo da empresa** |

O manifesto mora no frontmatter e **não** em registro separado: registro paralelo cria um
segundo lugar onde a entidade existe — a duplicação que o [[modelo-roteamento]] proíbe na
primeira linha e que D35 condena como cache que apodrece.

**Path é sempre por-operador, por-máquina — nunca conteúdo coletivo (D35, corte de raiz
17/08).** O manifesto **não declara URL nem path, nem relativo.** Ele só declara o *fato* de
que existe acervo fora da matriz (`externo`) — a chave pra achá-lo nesta máquina é o próprio
`conceito` (campo que já existia, usado pra casar; não inventamos um `escopo` novo porque esse
nome já é usado em toda a matriz pra governança/cliente, achado no dogfooding 17/08). O *onde*
fica inteiramente em `connect.config.json` (`subVaults`), resolvido por cada operador, na
própria máquina, nunca sincronizado. Isso elimina de raiz o problema de formato/âncora que o
campo `onedrive-rel` carregava (P69): não existe mais path nenhum pra formatar errado no
coletivo.

**Permissionamento é herdado da fonte, nunca implementado pelo Connect.** Sem acesso à fonte,
o mount falha — e a falha é resposta legítima (*"a entidade existe, você não alcança, procure
quem governa"*), não erro. É o que o produto promete: tornar a ausência visível.

**Nada nasce coletivo sozinho.** Uma entidade só existe no registro derivado quando um
operador **declarou** que ela existe — na sessão em que a concebeu (fábrica) ou na sessão em
que estruturou a organização. O agente nunca cria um manifesto por inferência.

---

## 2. Schema do manifesto (frontmatter)

Campos que todo manifesto declara. Frontmatter **puro** — nenhum path, nenhuma URL, nem
relativa (corte de raiz 17/08, resposta à P69).

| Campo | Obrigatório | Semântica | Fonte |
|---|---|---|---|
| `tipo` | **sim** | O que a entidade **é** (`organizacao`, `programa`, `squad`, `cliente`, `produto`, `operador`, …). A empresa declara; o produto não prescreve o conjunto | D98 |
| `papel` | **sim** | Como a entidade **opera** / o que ela hospeda (ex.: `tribo`, `cliente-externo`). Distinto de `tipo`: uma entidade pode ser `tipo: programa` e, ao mesmo tempo, `papel: tribo` | D99.4 |
| `governanca` | **sim** | Quem governa a entidade. É o que transforma a falha de mount de beco sem saída em ação; sem ele, D97 promete transparência e entrega erro | D99.3 |
| `conceito` / `alias` | não (default: slug do arquivo) | Chave **estável** de casamento — já existia no contrato anterior. Reaproveitada: também indexa a tabela local `subVaults` (por-operador, por-máquina). Declare quando o slug do arquivo não for estável o bastante | corte 17/08 |
| `externo` | não (default `false`) | Booleano: esta entidade tem acervo **fora** da matriz? `false`/omitido = conteúdo mora inline na própria matriz, nada a montar | corte 17/08 |
| `criado-por` / `criado-em` | não | Quem e quando **declarou que o acervo já foi materializado**. Ausência dos dois = a entidade foi concebida mas o acervo ainda não nasceu (`pendente-criacao`) — nunca inferido, sempre um operador que preenche | corte 17/08 |
| `entrada` | não | Nome da nota-hub **dentro do acervo** — só faz sentido com `externo:true`. É onde o mecanismo pousa assim que monta, sem tatear diretório | corte 17/08 |
| `depende-de` | quando houver relação | Arestas do **grafo** (D102): relação declarada para outros vaults. Cada item: `{ alvo, relacao }`. **Bidirecional explícito** — os dois lados declaram a aresta (ver §4) | D102 |

> **Onde foi `fonte`/`url`:** removido inteiro. Path é sempre por-operador, por-máquina —
> nunca frontmatter de entidade (§1). `conceito` é a única chave que o coletivo declara; o
> `resolver` casa essa chave contra `connect.config.json.subVaults` **nesta máquina**, nunca
> contra nada escrito no vault.

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
  moram lá, sempre montada), custo zero. O diferenciador **não é sintaxe especial de
  wikilink** — é o próprio manifesto: qualquer nota com `tipo`+`externo:true` é fronteira,
  independente de onde no organograma ela morar (área, tribo, cliente, squad — o produto não
  restringe a árvore, D98).
- **Path nunca é conteúdo coletivo** (D35): nenhum manifesto guarda diretório nem URL, relativa
  ou absoluta. O `resolver` nunca advinha nem pergunta por si só — devolve `status` pra a skill
  decidir (perguntar ao operador, acionar fábrica, avisar ausência). Ver `lib/resolver.mjs`.

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

1. Todo manifesto tem `tipo`, `papel`, `governanca`.
2. Nenhum `_cerebro/sub-vaults.json` (ou índice autorado equivalente) existe no vault.
3. Nenhum manifesto declara path/URL (frontmatter ou corpo) — `conceito`/`alias` são as
   únicas chaves, e nenhuma delas é path.
4. Manifesto com `tipo: cliente` mora em `clientes/`, fora da árvore organizacional.
5. **Consistência bidirecional do grafo:** para cada aresta `A → B`, existe a inversa
   `B → A` com relação coerente. Aresta órfã (declarada de um lado só) é issue.
6. `externo:true` sem `criado-por`/`criado-em` é estado válido (`pendente-criacao`), não é
   issue por si só — mas vale sinalizar se ficar pendente por muito tempo (ver
   `status-desatualizado-dias` do vault-audit).

---

## 6. Exemplos

```yaml
# organizacao/tribos/tribo-a/tribo-a.md  — tribo (exemplo genérico), acervo já materializado
tipo: programa
papel: tribo
governanca: <responsável pela tribo>
externo: true
criado-por: <quem materializou>
criado-em: 2026-08-17
entrada: hub-tribo-a          # nota-hub dentro do acervo — pousa direto nela
depende-de:
  - alvo: cliente/cliente-a
    relacao: atende
# conceito omitido: default = slug do arquivo ("tribo-a") — declare so se o slug
# nao for estavel o bastante pra indexar subVaults
```

```yaml
# organizacao/areas/area-b/area-b.md  — área SEM acervo próprio (conteúdo inline na matriz)
tipo: organizacao-area
papel: area
governanca: <responsável pela área>
# externo omitido = false: esta área não tem sub-vault, o conteúdo mora aqui mesmo
```

```yaml
# clientes/cliente-c.md  — entidade declarada, acervo AINDA NÃO materializado
tipo: cliente
papel: cliente-externo
governanca: <responsável pelo cliente>
externo: true
# sem criado-por/criado-em: resolver devolve 'pendente-criacao' — aciona a fábrica,
# nunca cria sozinho. O path local só entra na tabela subVaults DEPOIS de existir.
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
