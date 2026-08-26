# Connect — Contrato de Navegação (o interior do vault)

> O par que faltava do [contrato de manifesto](./contrato-manifesto.md). O manifesto responde
> **"esta entidade existe, quem governa, o acervo é externo?"** — a **fronteira**. Este contrato
> responde **"montei o acervo; por onde entro, o que é camada 1, em que ordem procuro?"** — o
> **interior**. Mecanismo, entregue e mantido pelo produto (corte `_`/conteúdo, D96): o Connect
> declara a **exigência** (quais seções toda carta tem); a empresa responde o **como** (o que
> escreve em cada uma). O produto não prescreve os eixos de conteúdo (D98).
>
> Versão 0.2.0 · 2026-08-26 · Impulsa / Viceri

---

## 1. O problema que este contrato fecha

Sem contrato de interior, o mecanismo fica cego no instante seguinte ao mount, e o vazio
**força o contorno** — o agente cai em `grep`/varredura, que é justamente o que a espinha
proíbe. Quatro defeitos observados no dogfooding — três em 17/08, o quarto em 26/08:

1. **`entrada` era nome de nota, não caminho.** `resolver` devolvia `entrada: "Connect"`; pousar
   nela exigia varrer o diretório — a operação que o protocolo classifica como sinal de
   configuração faltante. O D120 fechou a *intenção* do D103, não o mecanismo.
2. **A camada 1 era prescrita pelo produto.** `montarL1()` emitia um conjunto fixo de ponteiros
   ("`_cerebro/modelo-roteamento.md`", "`organizacao`", …) — contradição direta com D98: o
   produto decidindo os eixos do vault. Em um sub-vault que não segue esses nomes, o resultado
   era `ponteiros: []`: acervo montado sem uma única indicação de navegação.
3. **Assimetria coletivo × pessoal.** O hot cache **pessoal** era injetado verbatim; o coletivo
   entrava como uma lista de links. O vault coletivo era o único dos três (mecanismo, operador,
   coletivo) sem voz própria na camada 1 — apesar de ser o que mais tem a dizer.
4. **A carta podia não chegar, e o mecanismo não tinha como saber.** *(26/08)* A entrega tinha um
   canal só: o bloco de sessão **anuncia** um arquivo de contexto, e a carta vive dentro dele,
   atrás de um passo de leitura. Esse passo falhou duas vezes em sessões reais — o arquivo não
   abriu porque a origem do workspace não estava concedida ao harness. O produto gastou tokens
   anunciando uma carta que nunca chegou, e a navegação se fez sem carta e sem protocolo.
   **Canal único de entrega da camada 1 é ponto único de falha** — é o defeito que a ADR-17 fecha,
   e a razão de §2.1 ter deixado de recusar a convenção `CLAUDE.md`.

**Prova de existência:** um coletivo maduro operando sem Connect (só mounts + hot cache) navega
bem porque alguém **curou** o índice à mão. Curadoria de navegação **não é derivável por
varredura** — nenhuma varredura descobre "esta pasta é peça pesada, carregue só por gatilho".
O produto não deve inventá-la; deve **hospedar** a declaração e garantir que ela chega ao
contexto.

---

## 2. O artefato — `_cerebro/camada-1.md`

| | Manifesto (fronteira) | **Carta de navegação (interior)** |
|---|---|---|
| Onde mora | frontmatter da nota da entidade, **na matriz** | `_cerebro/camada-1.md`, **na raiz do próprio vault** |
| Responde | existe? quem governa? é externo? | por onde entro? o que é camada 1? o que carrego só por gatilho? |
| Quem escreve | quem declara a entidade | quem governa **aquele** vault |
| Como chega ao contexto | `resolver` devolve status | por **dois canais**: o mecanismo, que a injeta verbatim no bloco de sessão ao montar (sempre), e o espelho `{vault}/CLAUDE.md` em pasta conectada, onde o harness tiver a convenção (§2.1) |
| Ausência | `pendente-criacao` → fábrica | **lacuna reportada** → `cnct-fabrica-navegacao` |

Vale para **todo** vault desta instância — a matriz e cada sub-vault. Mesma forma em todos os
níveis (o corolário do D97 aplicado ao interior).

### 2.1 A casa canônica, e o que fazer com `CLAUDE.md`

**A casa canônica não muda: `_cerebro/camada-1.md`.** `CLAUDE.md` é convenção de uma ferramenta
específica e carrega uma promessa que o Connect não faz (ser lido por convenção do harness). A
garantia aqui é **estrutural**: o mecanismo lê e injeta. O nome é do mecanismo, e continua sendo —
mover a carta para `CLAUDE.md` acoplaria o contrato ao nome que um harness escolheu e quebraria todo
vault resolvido por junction, que é a maioria dos casos.

**Mas recusar *depender* da convenção não é recusar *usá-la*.** Até 26/08 esta seção parava na
recusa — decidia não usar o nome e não decidia o que fazer com ele **existindo**. Mediu-se então
(D225) que o harness carrega sozinho o `CLAUDE.md` da raiz de pasta conectada, sem concessão extra e
sem passo de leitura, antes de qualquer ferramenta ser chamada; e que não o entrega neutro — embrulha
como *override* (D226), nível de precedência que a saída de hook não alcança. Enquanto o produto só
recusava o nome, **o slot de maior precedência do contexto ficava sob autoria não governada** (D222).
A ADR-17 decidiu ocupá-lo: `{vault}/CLAUDE.md` passa a ser **espelho derivado** da fonte, publicado
pelo mecanismo. Acoplamento fraco — usar onde há, nunca depender; onde não há, nada muda.

Depois dessa decisão, **três arquivos diferentes se chamam `CLAUDE.md`**, e o tratamento de cada um é
distinto. Confundi-los é o modo de falha desta seção — a fábrica migra o arquivo errado, ou a
auditoria reporta o espelho como defeito:

| Arquivo | O que é | Tratamento |
|---|---|---|
| `_cerebro/CLAUDE.md` | **carta legada** — coletivo anterior ao Connect cumprindo o papel da camada 1 | lida como carta: origem marcada, injetada igual, migração anunciada. Nunca reescrita por conta própria. **Não está na raiz, logo não disputa o slot** |
| `{vault}/CLAUDE.md` **com** marcador válido | **espelho** derivado da fonte | publicado e regenerado pelo mecanismo; nunca autorado à mão |
| `{vault}/CLAUDE.md` **sem** marcador válido | arquivo **não governado** no slot de maior precedência | issue reportada no início da sessão (D222/§5 check 7). Não é lacuna de carta — é ocupação indevida |

**Regras do espelho** (ADR-17, D228/D229):

- **Fonte única.** O espelho é derivado de `_cerebro/camada-1.md` e herda todas as invariantes dela
  (§4) — inclusive a proibição de path de máquina. **Editar o espelho à mão é o ponto de
  não-retorno** declarado na ADR: a partir daí existem duas cartas divergentes a reconciliar.
- **Marca verificável.** Todo espelho carrega `CNCT-L1-{vault}-{hash-da-fonte}` e `gerado-em`. É a
  marca que torna procedência, supressão e detecção **deriváveis** em vez de instruídas. Hash que
  não bate com a fonte é procedência quebrada: reportar e regenerar.
- **Vault que não recebe escrita não recebe espelho.** Espelho ausente **não é lacuna** — é o caso
  normal de vault somente-leitura, legado ou não conectado.
- **Supressão é endereçamento, não obediência.** O bloco de sessão lista cada carga com seu marcador
  e hash; o agente que já tem `CNCT-L1-{vault}-{hash}` no contexto não abre aquele arquivo. É decisão
  de leitura sobre conteúdo endereçável — não instrução em prosa, que é a classe de garantia que
  D104/D152/D157 já mostraram falhar.
- **Supressão é otimização; entrega é garantia.** Supressão falhar custa **token**; a camada 1 não
  chegar custa **navegação por adivinhação**. São classes diferentes, e tratá-las como iguais é o que
  travou a formulação anterior desta decisão por três sessões (D228).

---

## 3. Seções do contrato

**Obrigatórias** (a ausência de qualquer uma é lacuna reportada):

| Seção | O que declara | Por que é obrigatória |
|---|---|---|
| `## O que é este vault` | Uma frase de escopo + o princípio de corte (o que entra, o que não) | Sem isso o agente não sabe se o que ele tem em mãos pertence aqui |
| `## Estrutura` | Mapa de pastas → **propósito** (não árvore de arquivos) | É o que substitui a varredura: dá destino sem listar diretório |
| `## Ordem de entrada` | O ponto de pouso e a sequência de leitura a partir dele | É a "ordem para encontrar notas" — sem ela, ordem nenhuma é garantida |
| `## Quando carregar` | Tabela **gatilho detectado → arquivo**, com peças pesadas marcadas | É o lazy declarado pelo vault (ADR-6) em vez de adivinhado |
| `## Fronteiras` | O que **não** mora aqui, nomeando o **conceito** a resolver | Fecha o loop com o manifesto: o agente sabe quando sair, e por onde |

**Opcionais** (recomendadas onde fizerem sentido):
`## Modelo relacional` (quem contém quem; o que é metadado e não container) ·
`## Camadas de herança` (quando o processo desce por deltas) ·
`## Triggers obrigatórios` (ex.: antes de escrever, carregar o protocolo de escrita) ·
`## Estado volátil` (o que muda toda semana e onde mora — nunca aqui dentro) ·
`## Pessoas-chave` (quando resolver nome for rotina no vault).

---

## 4. Invariantes

- **Índice no hot cache, peso no destino.** A carta é índice + gatilho. Conteúdo denso mora na
  nota semântica e entra sob demanda. Carta que cresce vira o problema que ela resolve —
  o mecanismo **avisa** ao passar de 250 linhas (sinal de conteúdo vazando para o índice).
- **Deltas, não cópias.** O que já é verdade numa camada acima é **linkado**, nunca reescrito.
  Cópia local desatualizada é o modo de falha mais observado (D34/D35).
- **A carta é autorada, o índice de entidades é derivado.** Não há contradição com a proibição
  de registro autorado (contrato-manifesto §3): aquilo proíbe **duplicar fato derivável**
  (quais entidades existem). Curadoria de navegação não é fato derivável — é decisão.
- **A carta nunca guarda path de máquina** (D35). Caminhos são relativos à raiz do próprio
  vault; o *onde no disco* mora em `connect.config.json`.
- **Ausência é gatilho de nascimento, não erro** (D97). Vault sem carta monta normalmente,
  com a lacuna anunciada e a fábrica oferecida — nunca com ponteiro inventado pelo produto.
- **O espelho é derivado, nunca autorado** (ADR-17/D229). A fonte é `_cerebro/camada-1.md`;
  `{vault}/CLAUDE.md` é publicação dela, com marcador e hash, e herda as invariantes acima. Espelho
  **ausente não é lacuna** (vault sem escrita não recebe espelho). Espelho **sem marcador não é
  espelho**: é arquivo não governado ocupando o slot de maior precedência, e é issue.
- **`entrada` do manifesto é caminho relativo ao acervo** (ex.: `projetos/Connect/Connect.md`),
  não nome de nota. Nome puro é aceito como legado e resolvido por busca limitada, que **deixa
  marca** (aviso + issue): a busca é o sintoma de um manifesto incompleto.

---

## 5. Face de verificação

Par exigência → resposta → verificação (D29/D30/D99). **Estado honesto de cada check** —
mecanismo (o plugin garante) × pendente (hoje depende de disciplina, e por isso não é garantia):

| # | Check | Estado |
|---|---|---|
| 1 | Todo vault montado tem `_cerebro/camada-1.md` (ou a carta legada, com migração pendente) | **mecanismo** — `lerCarta` detecta ausência/legado e anuncia no bloco de sessão |
| 2 | A carta tem as 5 seções obrigatórias (§3) | **mecanismo** — `validarCarta` (casamento por sinônimo/prefixo, H2 e H3) |
| 3 | Todo caminho citado na carta existe no vault (ponteiro morto é issue) | **pendente** — hoje só a `cnct-fabrica-navegacao` (Passo 4.2) confere, por disciplina |
| 4 | A carta tem ≤ 250 linhas (acima disso, "peso no índice") | **mecanismo** — aviso, não bloqueio |
| 5 | Todo `## Fronteiras` nomeia **conceito**, nunca caminho de máquina nem URL | **pendente** |
| 6 | **Nota órfã:** nota que nenhum hub alcança por ponteiro declarado — só encontrável por varredura — é issue | **pendente** — a espinha já obriga a *reportar* a varredura; o check sistemático é do `vault-audit` |
| 7 | Todo `CLAUDE.md` na **raiz** de vault do grafo tem marcador `CNCT-L1-…` válido — sem marcador é arquivo não governado no slot de maior precedência, e é issue | **pendente** — decidido na ADR-17; vira mecanismo quando o `iniciar_sessao` implementar a detecção |
| 8 | O hash do marcador do espelho bate com a fonte `_cerebro/camada-1.md` (divergência → reportar e regenerar) | **pendente** — decidido na ADR-17; vira mecanismo quando a `cnct-fabrica-navegacao` publicar o espelho |

> Os cinco checks pendentes são pendentes por **duas razões diferentes**, e a distinção importa.
> Os checks 3, 5 e 6 dependem do `vault-audit`, que vive no coletivo (não no plugin). Os checks 7 e
> 8 dependem de código do plugin **ainda não escrito**: o contrato declara o espelho antes de o
> mecanismo publicá-lo, e essa divergência é deliberada — declarar primeiro é o que dá ao código um
> alvo, e esta coluna é o lugar de dizer que ele ainda não chegou lá.
>
> O check 6 é o que faz "sem notas soltas" deixar de ser boa intenção: uma nota que só o `grep` acha
> é, por definição, uma nota que a curadoria perdeu. Enquanto ele não existir, a garantia disponível
> é o **relato obrigatório** da varredura pela espinha — visibilidade, não bloqueio.

---

## 6. Exemplo (genérico)

```markdown
---
tipo-artefato: camada-1
vault: Acervo da tribo-a
versao: "1.0"
atualizado: 2026-08-17
---

# Camada 1 — Acervo da tribo-a

## O que é este vault
Acervo da tribo-a: projetos conduzidos por ela e o processo da squad.
Corte: o que é verdade para qualquer pessoa da tribo entra; o que depende de quem
está sentado fica no vault do operador.

## Estrutura
- `projetos/` — uma nota-fonte por projeto (decisões, pendências, backlog)
- `squads/` — composição e processo de cada squad
- `_inteligencia/` — knowledge das skills deste vault

## Ordem de entrada
1. `projetos/produto-a/produto-a.md` — nota-fonte (ponto de pouso declarado no manifesto)
2. Dela, seguir só wikilink: decisões → ADR → backlog
3. Estado da semana: `squads/squad-a/estado-coletivo.md`

## Quando carregar
| Gatilho detectado | Arquivo |
|---|---|
| decisão de arquitetura, ADR | `projetos/produto-a/adr/adr-produto-a.md` |
| quem faz o quê, alocação | `squads/squad-a/equipe.md` |
| norma pesada do cliente | `cliente/normas/...` (peça pesada — só por gatilho) |

## Fronteiras
- Governança, políticas e organograma → **não** moram aqui: conceito `matriz`
- Contexto de outro cliente → conceito do próprio cliente (resolver, nunca supor)
```

---

> Fontes de decisão: D96 (corte `_`/conteúdo), D97 (ausência = nascimento; manifesto+acervo),
> D98 (produto hospeda, não prescreve), D102 (grafo), D103 (acervo lazy, ponteiro tipado),
> D104 (espinha é mecanismo injetado), D120 (`entrada` no manifesto), D222 (colisão de camada 0 —
> arquivo não governado no slot de maior precedência), D225 (o canal `CLAUDE.md` de pasta conectada
> existe e foi medido), D226 (o canal carrega rótulo de *override*), D228 (supressão é otimização;
> entrega é garantia), D229 (espelho derivado, nunca segunda casa), D230 (o slot é vetor de injeção
> em vault compartilhado — P145, dono em SI/Infra), ADR-6 (token-efficiency lazy), ADR-17 (canal
> duplo de camada 1 por espelho governado). Pendências que este contrato consome: P66 (passos
> 1/3/4/5), P70 (texto do render), P137 e P139 (ambas fechadas pela ADR-17).
