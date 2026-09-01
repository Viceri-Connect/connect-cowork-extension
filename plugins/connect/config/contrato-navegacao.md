# Connect — Contrato de Navegação (o interior do vault)

> O par que faltava do [contrato de manifesto](./contrato-manifesto.md). O manifesto responde
> **"esta entidade existe, quem governa, o acervo é externo?"** — a **fronteira**. Este contrato
> responde **"montei o acervo; por onde entro, o que é camada 1, em que ordem procuro?"** — o
> **interior**. Mecanismo, entregue e mantido pelo produto (corte `_`/conteúdo): o Connect
> declara a **exigência** (quais seções toda carta tem); a empresa responde o **como** (o que
> escreve em cada uma). O produto não prescreve os eixos de conteúdo.
>
> Versão 0.3.0 · 2026-08-26 · Impulsa / Viceri

---

## 1. O problema que este contrato fecha

Sem contrato de interior, o mecanismo fica cego no instante seguinte ao mount, e o vazio
**força o contorno** — o agente cai em `grep`/varredura, que é justamente o que a espinha
proíbe. Quatro defeitos observados no dogfooding — três em 17/08, o quarto em 26/08:

1. **`entrada` era nome de nota, não caminho.** `resolver` devolvia `entrada: "Connect"`; pousar
   nela exigia varrer o diretório — a operação que o protocolo classifica como sinal de
   configuração faltante.
2. **A camada 1 era prescrita pelo produto.** `montarL1()` emitia um conjunto fixo de ponteiros
   ("`_cerebro/modelo-roteamento.md`", "`organizacao`", …) — contradição direta com
   `vault-declara-produto-nao-prescreve` (GLOSSARIO.md): o produto decidindo os eixos do
   vault. Em um sub-vault que não segue esses nomes, o resultado
   era `ponteiros: []`: acervo montado sem uma única indicação de navegação.
3. **Assimetria coletivo × pessoal.** O hot cache **pessoal** era injetado verbatim; o coletivo
   entrava como uma lista de links. O vault coletivo era o único dos três (mecanismo, operador,
   coletivo) sem voz própria na camada 1 — apesar de ser o que mais tem a dizer.
4. **A carta podia não chegar, e o mecanismo não tinha como saber.** *(26/08)* A entrega tinha um
   canal só: o bloco de sessão **anuncia** um arquivo de contexto, e a carta vive dentro dele,
   atrás de um passo de leitura. Esse passo falhou duas vezes em sessões reais — o arquivo não
   abriu porque a origem do workspace não estava concedida ao harness. O produto gastou tokens
   anunciando uma carta que nunca chegou, e a navegação se fez sem carta e sem protocolo.
   **Canal único de entrega da camada 1 é ponto único de falha** — é a razão de §2.1 ter
   deixado de recusar a convenção `CLAUDE.md`.

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
| Como chega ao contexto | `resolver` devolve status | **injetada verbatim** no bloco de sessão, ao montar. Em pasta conectada, o `{vault}/CLAUDE.md` (§2.1) chega antes disso e **aponta** para ela — governança e ponteiro, nunca cópia do conteúdo |
| Ausência | `pendente-criacao` → fábrica | **lacuna reportada** → `cnct-fabrica-navegacao` |

Vale para **todo** vault desta instância — a matriz e cada sub-vault. Mesma forma em todos os
níveis.

### 2.1 A casa canônica, e o que fazer com `CLAUDE.md`

**A casa canônica não muda: `_cerebro/camada-1.md`.** `CLAUDE.md` é convenção de uma ferramenta
específica e carrega uma promessa que o Connect não faz (ser lido por convenção do harness). A
garantia aqui é **estrutural**: o mecanismo lê e injeta. O nome é do mecanismo, e continua sendo —
mover a carta para `CLAUDE.md` acoplaria o contrato ao nome que um harness escolheu e quebraria todo
vault resolvido por junction, que é a maioria dos casos.

**Mas recusar *depender* da convenção não é recusar *usá-la*.** Até 26/08 esta seção parava na
recusa — decidia não usar o nome e não decidia o que fazer com ele **existindo**. Mediu-se então
que o harness carrega sozinho o `CLAUDE.md` da raiz de pasta conectada, sem concessão extra e
sem passo de leitura, antes de qualquer ferramenta ser chamada; e que não o entrega neutro — embrulha
como *override*, nível de precedência que a saída de hook não alcança. Enquanto o produto só
recusava o nome, **o slot de maior precedência do contexto ficava sob autoria não governada**.
A regra vigente é ocupá-lo com **instrução, nunca conteúdo**: `{vault}/CLAUDE.md` declara que o
vault é governado, carrega as **regras duras** e **aponta** para `_cerebro/camada-1.md`. Acoplamento
fraco — usar onde há, nunca depender; onde não há, nada muda.

> **Por que instrução e não cópia da carta.** Espelhar o *conteúdo* da carta aqui, com hash de
> frescor, exige **escrita recorrente** — e já se mediu o OneDrive resolvendo dois conflitos a
> favor da versão velha — um deles a própria carta da matriz, em silêncio, por sessões. Arquivo
> cujo texto **não depende do que a carta diz** nunca precisa ser reescrito, e é a única forma
> de o canal não virar fonte de conflito no vault sincronizado. O slot é bom para instrução e
> ruim para conteúdo.

Depois dessa decisão, **três arquivos diferentes se chamam `CLAUDE.md`**, e o tratamento de cada um é
distinto. Confundi-los é o modo de falha desta seção — a fábrica migra o arquivo errado, ou a
auditoria reporta como defeito o arquivo que o próprio mecanismo materializou:

| Arquivo | O que é | Tratamento |
|---|---|---|
| `_cerebro/CLAUDE.md` | **carta legada** — coletivo anterior ao Connect cumprindo o papel da camada 1 | lida como carta: origem marcada, injetada igual, migração anunciada. Nunca reescrita por conta própria. **Não está na raiz, logo não disputa o slot** |
| `{vault}/CLAUDE.md` **com** marcador válido | **arquivo de governança** — regras duras + ponteiro para a carta | materializado pelo mecanismo; nunca autorado à mão |
| `{vault}/CLAUDE.md` **sem** marcador válido | arquivo **não governado** no slot de maior precedência | issue reportada no início da sessão (§5 check 7). Não é lacuna de carta — é ocupação indevida |

**Regras do arquivo de governança:**

- **Não carrega conteúdo da carta.** Declara que o vault é governado, traz as regras duras e aponta
  para `_cerebro/camada-1.md`. A camada 1 continua sendo declarada num lugar só.
- **Write-once.** Como o texto não depende do que a carta diz, ele nunca desatualiza e nunca é
  regenerado. Republicar sem mudança de corpo **não escreve** — é o que impede o evento de escrita
  que vault sincronizado transforma em cópia de conflito.
- **Marcador de identidade, não de versão:** `CNCT-GOV-{vault}` + `gerado-em`. Responde *"este
  arquivo é nosso?"* e nada mais. Sem hash da fonte, porque não há fonte espelhada.
- **Só em vault de conhecimento** (`tipo-vault: matriz|sub-vault`). Perfil de operador nunca — lá
  `CLAUDE.md` já é a Camada 0. **Vault que não recebe escrita não recebe o arquivo**, e a ausência
  dele **nunca é lacuna**.
- **Nunca sobrescrever arquivo sem marcador nosso**, sem exceção e sem flag de força: pode ser
  Camada 0 legítima, sonda de medição ou conteúdo de terceiro. O mecanismo detecta e reporta —
  apagar não é atribuição dele.
- **A leitura do ponteiro é garantida por configuração, não por persuasão.** A matriz entra como
  pasta conectada do projeto Cowork; aí `_cerebro/camada-1.md` abre por construção. Sem isso, o
  arquivo vira ponteiro para caminho que pode não abrir — o defeito medido em 26/08.

---

## 3. Seções do contrato

**Obrigatórias** (a ausência de qualquer uma é lacuna reportada):

| Seção | O que declara | Por que é obrigatória |
|---|---|---|
| `## O que é este vault` | Uma frase de escopo + o princípio de corte (o que entra, o que não) | Sem isso o agente não sabe se o que ele tem em mãos pertence aqui |
| `## Estrutura` | Mapa de pastas → **propósito** (não árvore de arquivos) | É o que substitui a varredura: dá destino sem listar diretório |
| `## Ordem de entrada` | O ponto de pouso e a sequência de leitura a partir dele | É a "ordem para encontrar notas" — sem ela, ordem nenhuma é garantida |
| `## Quando carregar` | Tabela **gatilho detectado → arquivo**, com peças pesadas marcadas | É o lazy declarado pelo vault em vez de adivinhado |
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
  Cópia local desatualizada é o modo de falha mais observado.
- **A carta é autorada, o índice de entidades é derivado.** Não há contradição com a proibição
  de registro autorado (contrato-manifesto §3): aquilo proíbe **duplicar fato derivável**
  (quais entidades existem). Curadoria de navegação não é fato derivável — é decisão.
- **A carta nunca guarda path de máquina.** Caminhos são relativos à raiz do próprio
  vault; o *onde no disco* mora em `connect.config.json`.
- **Ausência é gatilho de nascimento, não erro.** Vault sem carta monta normalmente,
  com a lacuna anunciada e a fábrica oferecida — nunca com ponteiro inventado pelo produto.
- **O canal injetado recebe instrução, nunca conteúdo.** `{vault}/CLAUDE.md` é governança
  e ponteiro, write-once, com marcador de identidade `CNCT-GOV-{vault}`. Ausência **não é lacuna**
  (vault sem escrita não recebe o arquivo). Presença **sem marcador** não é o nosso arquivo: é
  conteúdo não governado ocupando o slot de maior precedência, e é issue — detectada e reportada,
  nunca sobrescrita.
- **`entrada` do manifesto é caminho relativo ao acervo** (ex.: `projetos/Connect/Connect.md`),
  não nome de nota. Nome puro é aceito como legado e resolvido por busca limitada, que **deixa
  marca** (aviso + issue): a busca é o sintoma de um manifesto incompleto.

---

## 5. Face de verificação

Par exigência → resposta → verificação. **Estado honesto de cada check** —
mecanismo (o plugin garante) × pendente (hoje depende de disciplina, e por isso não é garantia):

| # | Check | Estado |
|---|---|---|
| 1 | Todo vault montado tem `_cerebro/camada-1.md` (ou a carta legada, com migração pendente) | **mecanismo** — `lerCarta` detecta ausência/legado e anuncia no bloco de sessão |
| 2 | A carta tem as 5 seções obrigatórias (§3) | **mecanismo** — `validarCarta` (casamento por sinônimo/prefixo, H2 e H3) |
| 3 | Todo caminho citado na carta existe no vault (ponteiro morto é issue) | **pendente** — hoje só a `cnct-fabrica-navegacao` (Passo 4.2) confere, por disciplina |
| 4 | A carta tem ≤ 250 linhas (acima disso, "peso no índice") | **mecanismo** — aviso, não bloqueio |
| 5 | Todo `## Fronteiras` nomeia **conceito**, nunca caminho de máquina nem URL | **pendente** |
| 6 | **Nota órfã:** nota que nenhum hub alcança por ponteiro declarado — só encontrável por varredura — é issue | **pendente** — a espinha já obriga a *reportar* a varredura; o check sistemático é do `vault-audit` |
| 7 | Todo `CLAUDE.md` na **raiz** de vault de conhecimento tem marcador `CNCT-GOV-…` válido — sem marcador é conteúdo não governado no slot de maior precedência, e é issue | **mecanismo** — `verificarRaiz` (`lib/governanca.mjs`), chamado por `montarL1`: cobre a matriz no startup e todo sub-vault via `resolver`. Emitido como **seção** no topo do bloco acionável, não como aviso no fim |
| 8 | O mecanismo nunca sobrescreve `CLAUDE.md` de raiz sem marcador nosso | **mecanismo** — `publicarGovernanca` devolve `recusado`; não há flag de força |

> Os checks pendentes (3, 5 e 6) dependem do `vault-audit`, que vive no coletivo e não no plugin —
> por isso não são garantia estrutural ainda.
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
