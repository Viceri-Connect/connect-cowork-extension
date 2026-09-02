# Connect — Contrato de Navegação (o interior do vault)

> O par que faltava do [contrato de manifesto](./contrato-manifesto.md). O manifesto responde
> **"esta entidade existe, quem governa, o acervo é externo?"** — a **fronteira**. Este contrato
> responde **"montei o acervo; por onde entro, o que é camada 1, em que ordem procuro?"** — o
> **interior**. Mecanismo, entregue e mantido pelo produto (corte `_`/conteúdo): o Connect
> declara a **exigência** (quais seções toda carta tem); a empresa responde o **como** (o que
> escreve em cada uma). O produto não prescreve os eixos de conteúdo.
>
> Versão 0.6.0 · Impulsa / Viceri

---

## 0. Estado desta versão

> **Leia antes de tratar qualquer regra abaixo como vigente.**

**Todas as seções deste contrato são vigentes e têm mecanismo.** A v0.4.0 tinha duas metades com
estatuto diferente — §§1–6 com verificação, §§7–9 como *norma declarada, mecanismo pendente* — e essa
divisão foi fechada na v0.5.0:

| O que a v0.4.0 declarava sem mecanismo | O que a v0.5.0 executa |
|---|---|
| `processo:` não era lido em runtime | `lerCarta` lê o frontmatter da carta; `resolverHeranca` (`lib/heranca.mjs`) resolve a carta de processo e a injeta **uma vez por sessão**, com registro no workspace |
| a carta de processo não existia como artefato | casa canônica declarada e materializada: `_cerebro/processos/{processo}.md` no vault que governa o processo (§9.3) |
| as sete métricas da §9.4 não rodavam | `lib/metricas.mjs` implementa M1–M7; expostas pela tool `medir_navegacao` e consumidas pelo modo AUDIT |
| os orçamentos de M3 e M4 estavam em branco | fixados na §9.4, calibrados **depois** da primeira carta de processo publicada — como a própria v0.4.0 previu |

**O que continua pendente, e está declarado onde importa:** os checks 3, 5 e 6 da §5 deixaram de
depender de disciplina, mas a *correção* do que as métricas reportam segue sendo decisão do operador
— o mecanismo mede e reporta, nunca corrige nem bloqueia. Essa é a fronteira, e ela é deliberada:
`bloqueio-reporta-nunca-contorna` vale também para o produto olhando o vault.

**A v0.6.0 corrigiu duas coisas na própria v0.5.0, no mesmo dia, e as duas por medição:**

| O que a v0.5.0 fez | Por que estava errado | O que a v0.6.0 faz |
|---|---|---|
| toda a declaração de alcance na **carta**, uma entrada por nível | violava o critério da §7 que ela mesma implementa: maximizava massa no caminho (cobrada de todos) para economizar saltos (o de menor peso) | **corrente** — a carta declara casa + hub, o hub declara o nível (§8.0) |
| declaração em `alcance:` no **frontmatter**, como array de objeto | não é editável na view de Properties do Obsidian, e estes vaults são operados no Obsidian: atrito com a ferramenta em que o produto vive | tabela markdown numa seção **`## Alcance`**, recortada da injeção |
| M7 exigia **existência** das casas da `estrutura-minima` | reprovava todo vault recém-nascido — vault sem projeto não tem casa de ADR, e ela nasce no refinamento, não no provisionamento | M7 verifica **compatibilidade topológica** (`topologia:`), nunca existência |

> A forma legada (`alcance:` no frontmatter) continua sendo lida, para não quebrar vault migrado na
> janela de um dia. A tabela vence quando as duas existem.

> **Herança é aditiva antes da primeira poda e onerosa depois.** Um vault que declara `processo:`
> mas ainda não podou a carta local navega normalmente (superconjunto). A partir da primeira poda,
> desligar a herança deixa o vault sem a metade herdada — ponto de não-retorno registrado na decisão
> que originou esta versão.

---

## 1. O problema que este contrato fecha

Sem contrato de interior, o mecanismo fica cego no instante seguinte ao mount, e o vazio
**força o contorno** — o agente cai em varredura, que é justamente o que a espinha
proíbe. Quatro defeitos observados em uso real:

1. **`entrada` era nome de nota, não caminho.** `resolver` devolvia um nome; pousar
   nele exigia varrer o diretório — a operação que o protocolo classifica como sinal de
   configuração faltante.
2. **A camada 1 era prescrita pelo produto.** `montarL1()` emitia um conjunto fixo de ponteiros
   — contradição direta com `vault-declara-produto-nao-prescreve` (GLOSSARIO.md): o produto
   decidindo os eixos do vault. Em um sub-vault que não segue esses nomes, o resultado
   era `ponteiros: []`: acervo montado sem uma única indicação de navegação.
3. **Assimetria coletivo × pessoal.** O hot cache **pessoal** era injetado verbatim; o coletivo
   entrava como uma lista de links. O vault coletivo era o único dos três (mecanismo, operador,
   coletivo) sem voz própria na camada 1 — apesar de ser o que mais tem a dizer.
4. **A carta podia não chegar, e o mecanismo não tinha como saber.** A entrega tinha um
   canal só: o bloco de sessão **anuncia** um arquivo de contexto, e a carta vive dentro dele,
   atrás de um passo de leitura. Esse passo falhou em sessões reais — o arquivo não
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
| Como chega ao contexto | `resolver` devolve status | **corpo injetado verbatim** no bloco de sessão, ao montar (o frontmatter é declaração para o mecanismo — §8.0 — e não é injetado). Em pasta conectada, o `{vault}/CLAUDE.md` (§2.1) chega antes disso e **aponta** para ela — governança e ponteiro, nunca cópia do conteúdo |
| Ausência | `pendente-criacao` → fábrica | **lacuna reportada** → `cnct-fabrica-navegacao` |

Vale para **todo** vault desta instância — a matriz e cada sub-vault. Mesma forma em todos os
níveis.

### 2.1 A casa canônica, e o que fazer com `CLAUDE.md`

**A casa canônica não muda: `_cerebro/camada-1.md`.** `CLAUDE.md` é convenção de uma ferramenta
específica e carrega uma promessa que o Connect não faz (ser lido por convenção do harness). A
garantia aqui é **estrutural**: o mecanismo lê e injeta. O nome é do mecanismo, e continua sendo —
mover a carta para `CLAUDE.md` acoplaria o contrato ao nome que um harness escolheu e quebraria todo
vault resolvido por junction, que é a maioria dos casos.

**Mas recusar *depender* da convenção não é recusar *usá-la*.** Esta seção parava na
recusa — decidia não usar o nome e não decidia o que fazer com ele **existindo**. Mediu-se então
que o harness carrega sozinho o `CLAUDE.md` da raiz de pasta conectada, sem concessão extra e
sem passo de leitura, antes de qualquer ferramenta ser chamada; e que não o entrega neutro — embrulha
como *override*, nível de precedência que a saída de hook não alcança. Enquanto o produto só
recusava o nome, **o slot de maior precedência do contexto ficava sob autoria não governada**.
A regra vigente é ocupá-lo com **instrução, nunca conteúdo**: `{vault}/CLAUDE.md` declara que o
vault é governado, carrega as **regras duras** e **aponta** para `_cerebro/camada-1.md`. Acoplamento
fraco — usar onde há, nunca depender; onde não há, nada muda.

> **Por que instrução e não cópia da carta.** Espelhar o *conteúdo* da carta aqui, com hash de
> frescor, exige **escrita recorrente** — e já se mediu plataforma de sync resolvendo conflitos
> a favor da versão velha, em silêncio, por sessões. Arquivo
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
  pasta conectada do projeto do harness; aí `_cerebro/camada-1.md` abre por construção. Sem isso, o
  arquivo vira ponteiro para caminho que pode não abrir.

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
  nota semântica e entra sob demanda. Carta que cresce vira o problema que ela resolve.
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
- **`entrada` do manifesto é caminho relativo ao acervo**, não nome de nota. Nome puro é aceito
  como legado e resolvido por busca limitada, que **deixa marca** (aviso + issue): a busca é o
  sintoma de um manifesto incompleto.

---

## 5. Face de verificação

Par exigência → resposta → verificação. **Estado honesto de cada check** —
mecanismo (o plugin garante) × pendente (hoje depende de disciplina, e por isso não é garantia):

| # | Check | Estado |
|---|---|---|
| 1 | Todo vault montado tem `_cerebro/camada-1.md` (ou a carta legada, com migração pendente) | **mecanismo** — `lerCarta` detecta ausência/legado e anuncia no bloco de sessão |
| 2 | A carta tem as 5 seções obrigatórias (§3) | **mecanismo** — `validarCarta` (casamento por sinônimo/prefixo, H2 e H3) |
| 3 | Todo caminho citado na carta existe no vault (ponteiro morto é issue) | **mecanismo** — **M5**. Classifica em quatro naturezas, porque fundi-las produziu 16 falsos positivos na primeira execução real: *morto* (falha) · *ambíguo* (existe, não a partir da raiz) · *fora do vault* (arquivo do produto ou de outro vault — é ponteiro que deveria ser tipado) · *herdado sem casa* (domínio da M7, não duplicado aqui) |
| 4 | ~~A carta tem ≤ 250 linhas~~ — **substituído por M3 (§9.4)**. Linha era a grandeza errada, e a medição é a prova: as quatro cartas desta instância tinham 124–147 linhas (todas abaixo do limite), custavam ~1.900 a ~3.600 tokens cada, e **o aviso nunca disparou em nenhuma** | **mecanismo** — **M3**, em tokens, e em duas partes com donos distintos |
| 5 | Todo `## Fronteiras` nomeia **conceito**, nunca caminho de máquina nem URL | **mecanismo** — **M6** (seção ausente ou vazia também é violação: sem ela o agente não sabe quando sair) |
| 6 | **Nota órfã:** nota que nenhum hub alcança por ponteiro declarado — só encontrável por varredura — é issue | **mecanismo** — **M1**, computável desde a v0.5.0: órfã é o arquivo que nenhuma declaração de alcance cobre. As casas do próprio mecanismo (`_cerebro/`, `_inteligencia/`, `_automacoes/`) são cobertas por construção — exigi-las da carta seria o produto cobrando do coletivo a declaração de pasta que o produto impõe |
| 7 | Todo `CLAUDE.md` na **raiz** de vault de conhecimento tem marcador `CNCT-GOV-…` válido — sem marcador é conteúdo não governado no slot de maior precedência, e é issue | **mecanismo** — `verificarRaiz` (`lib/governanca.mjs`), chamado por `montarL1`: cobre a matriz no startup e todo sub-vault via `resolver`. Emitido como **seção** no topo do bloco acionável, não como aviso no fim |
| 8 | O mecanismo nunca sobrescreve `CLAUDE.md` de raiz sem marcador nosso | **mecanismo** — `publicarGovernanca` devolve `recusado`; não há flag de força |

> **Os oito checks são mecanismo, e nenhum bloqueia.** Medir e reportar é a atribuição; corrigir é
> decisão do operador. A diferença em relação à v0.4.0 não é a severidade — é que antes o defeito
> **não aparecia**, e o que não aparece não é decidido: é herdado.
>
> O check 6 é o que faz "sem notas soltas" deixar de ser boa intenção: uma nota que só a varredura
> acha é, por definição, uma nota que a curadoria perdeu. A garantia adicional do **relato
> obrigatório** da varredura pela espinha continua valendo — as duas se somam.

---

## 6. Exemplo (genérico)

```markdown
---
tipo-artefato: camada-1
vault: Acervo da tribo-a
versao: "1.0"
atualizado: AAAA-MM-DD
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

# O critério, o alcance e a herança

> **§§ 7 a 9.** Vigentes e com mecanismo desde a v0.5.0 (ver §0). A §7 é **critério de decisão** e
> não tem como ter mecanismo — é o árbitro que as §§8–9 aplicam. As §§8–9 são lidas em runtime e
> verificadas pelas métricas da §9.4.

## 7. O critério — custo de resgate

É o **árbitro** de todas as regras abaixo. Sem ele, "encaixe torto" é gosto pessoal e a discussão
de forma vira estética de pasta.

A forma de um destino é a que **minimiza o custo de resgate**. Três componentes, pesos desiguais,
ordem de arbitragem fixa: minimizar (1), depois (2), depois (3).

| # | Componente | O que é | Peso |
|---|---|---|---|
| 1 | **Risco de varredura** | a chance de o agente não alcançar a nota por ponteiro declarado e cair em varredura | **domina** — é o único que produz resposta **errada**, não só cara |
| 2 | **Massa no caminho** | tokens dos arquivos abertos até chegar lá | alto e recorrente — cobrada de **todos** que passam, inclusive de quem ia para outro lugar |
| 3 | **Saltos declarados** | quantos ponteiros da carta até a nota | baixo — cobrado só de quem vai |

> **Consequência contraintuitiva, e é o ponto todo: mais saltos costuma ser melhor.** Um salto custa
> uma leitura pequena e **reduz** massa (índice fino → nota específica, em vez de índice gordo que
> todo mundo carrega). Achatar para "achar mais rápido" não reduz salto nenhum — a carta continua
> sendo o ponto de pouso — e aumenta o risco de varredura, que é o componente dominante.

**Quando o resgate ótimo conflita com a realidade do time:** a **estrutura segue o resgate; o
vocabulário segue o time**. Não se renomeia um termo consagrado do time para agradar o mecanismo —
o termo é dele, e resistir a isso quebra a adoção. Mas **onde** aquilo mora é decidido por custo de
resgate.

---

## 8. Contrato de alcance de nível

> Substitui a ideia de "teto de arquivos por nível", que erra nos dois sentidos: mandaria quebrar um
> diretório de dezenas de arquivos homogêneos que custa ~zero, e deixaria passar um de meia dúzia de
> arquivos heterogêneos que custa caro.

Um nível é válido enquanto **todo arquivo nele estiver coberto por uma declaração de três partes**
na carta:

**casa** (onde mora) · **padrão de nomenclatura** (como se chama) · **campos de frontmatter
filtráveis** (por que se recorta)

Com os três declarados, o nível é alcançável **por construção**, tenha 5 ou 500 arquivos. Faltando
um, é caro mesmo com 5. **O que "estoura" não é a contagem — é o arquivo que nenhuma declaração
cobre**, e esse é, por definição, a nota órfã do check 6.

### 8.0 A corrente: a carta declara a casa, o hub declara o nível

A declaração **não** fica toda na carta. A carta declara a **casa** e **quem a governa** (o hub); o
hub declara o alcance do nível dele. A cobertura é **transitiva** e continua total — nada vira órfã
enquanto a corrente estiver completa —, e cada sessão paga apenas a declaração das casas em que entra.

> **Por que a corrente, e não a lista na carta.** A primeira implementação pôs uma entrada por
> **nível** na carta de navegação, e isso violava o próprio critério que o alcance implementa: a §7
> arbitra risco de varredura (1), massa no caminho (2), saltos (3), e declara que *mais saltos costuma
> ser melhor, porque um salto custa uma leitura pequena e **reduz** massa*. Concentrar a declaração na
> carta maximiza (2) — cobrado de **todos** que passam, inclusive de quem ia para outro lugar — para
> economizar (3), que é o de menor peso e cobrado só de quem vai. Invertido.

**Forma: tabela markdown numa seção `## Alcance`, no corpo.** Uma linha por nível:

| Casa | Padrão | Grau | Filtros | Hub |
|---|---|---|---|---|
| `projetos/{ciclo}/{projeto}` | — | — | — | `projetos/{ciclo}/{projeto}/{projeto}.md` |
| `caso-zero` | `{data}-{slug}.md` | derivável | data, tags | — |
| `.` | `*.docx` | listável | — | — |

- **`Casa`** — onde mora. Placeholders: `{N}` (inteiro), `{data}` (AAAA-MM-DD), `{qualquer}` (um
  segmento), `*` / `**`. A **raiz** do vault é `.` — explícita, nunca célula vazia, porque vazia é
  ambígua entre *raiz* e *esqueci de preencher*.
- **`Hub` preenchido e `Padrão` vazio** = casa **delegada**: o alcance daquele nível está no hub.
- **`Hub` e `Padrão` juntos** = o nível tem padrão **e** mantém índice autorado. Não é delegação —
  é a classe de defeito da §8.1, e a M2 reporta.

**Tabela, e não frontmatter.** Array de objeto em YAML não é editável na view de Properties do
Obsidian, e estes vaults são operados no Obsidian: forma do produto que atrita com a ferramenta em
que o produto vive é defeito de dogfooding. Tabela é o idioma que carta e hub já usam. O frontmatter
guarda só escalares — `processo:` e `topologia:`.

**Nem o frontmatter nem a seção `## Alcance` são injetados no contexto.** São declaração para o
mecanismo. Sem esse recorte, declarar bem custaria tokens em toda sessão e o teto da M3 puniria
exatamente o vault que cumpre o contrato — incentivo invertido.

### 8.0.1 O corte entre declarar na carta e delegar ao hub

| Declara na **carta** (ou na carta de processo) | Delega ao **hub da casa** |
|---|---|
| o que é **forma do processo** e é idêntico em toda instância: ADR, RNF, backlog, histórico | o que é **do vault** e ilimitado: contexto de cliente, produtos, catálogos, capturas |
| serve N instâncias com uma declaração | serve uma casa, e só é cobrado de quem entra nela |

**Foi medição que fixou esse corte.** Delegar as casas internas do projeto à nota-fonte obrigaria as
**17** notas de projeto de um acervo de cliente maduro a repetir a mesma declaração — 17 cópias do que
é forma do processo, que é a violação de *deltas, não cópias* um andar abaixo.

**Hub sem `## Alcance` não é defeito** — declarar delta é o caso excepcional, não o normal. Quem cobra
o resultado é a M1: se a corrente não cobriu algum arquivo, ele aparece **nomeado** como órfã.
Reportar a *forma* (seção ausente) em vez da *consequência* (arquivo inalcançável) produziria dezenas
de defeitos onde não há nenhum. **Hub declarado que não existe**, sim, é defeito: a corrente quebra
ali e o nível abaixo fica sem cobertura, com a carta parecendo completa.

### 8.1 Os três graus de padrão

| Grau | O agente… | Índice autorado |
|---|---|---|
| **Derivável** | constrói o nome sozinho (identificador sequencial, data) | dispensável |
| **Listável** | não constrói o nome, mas a casa é declarada e listar aquele diretório é barato e completo | **dispensável** — a listagem derivada substitui |
| **Nenhum dos dois** | nível heterogêneo sem padrão | obrigatório |

> **Índice autorado sobre nível listável é defeito, não zelo.** Ele cobra a massa inteira de todo
> mundo que passa **e apodrece** — o inventário para de ser incrementado e passam a existir arquivos
> em disco que o caminho declarado não alcança, ou seja, órfãs produzidas pelo próprio índice. A
> listagem cobra apenas os nomes e nunca desatualiza.

Isto fecha o par **listagem derivada × índice autorado**: o índice autorado é obrigatório **apenas**
onde o padrão não é derivável nem listável. Onde há casa + padrão + filtro, o índice é derivado e o
hub encolhe a um ponteiro.

### 8.2 Quando um índice se parte, e por qual eixo

**O eixo é probabilidade de acionamento.** Tipo, tempo e ciclo de vida são admissíveis apenas como
**proxies**, e só quando correlacionam com ela.

O motivo é o componente (2) da §7: massa é cobrada de todos que passam, logo o primeiro nível
carrega o que a **maioria das sessões** dispara, e nada mais. Tipo não reduz massa nenhuma — cada
tipo continua sendo carregado por quem passa. Tempo e ciclo de vida reduzem **porque** histórico é
raramente acionado, não porque é antigo.

**Regra:** uma linha que dispara em menos de ~1 sessão em 5 desce para o segundo nível, e o primeiro
ganha **uma** linha apontando para ele.

---

## 9. A carta como delta, e a herança de processo

> A §4 já declara o invariante *"deltas, não cópias — o que já é verdade numa camada acima é
> linkado, nunca reescrito"*. Cartas em uso violam esse invariante de forma sistemática: a maior
> parte do que elas declaram não é delas, e sim mecanismo do produto ou processo do coletivo,
> reescrito uma vez por vault.

### 9.1 O que é da carta local

Apenas o **não-derivável**, que é sempre decisão e nunca fato:

1. **Identidade e corte** — o que é este vault, o que entra, o que não entra.
2. **Os deltas** — onde este vault difere do processo que executa.
3. **Entidades e vocabulário locais** — o que não existe em nenhum outro lugar.
4. **Fronteiras específicas** — *quais* conceitos vizinhos existem.

### 9.2 Os dois destinos do resto

| Origem | Destino | O que é |
|---|---|---|
| **Mecanismo** | protocolo injetado (`protocolo-mecanismo.md`) — já entra uma vez por sessão | triggers de escrita e encerramento, taxonomia local, esquema de identificadores, estado do operador, resolução de repositório, fonte única do manifesto, o princípio de não pousar em folha |
| **Processo** | **carta de processo**, no vault que governa o processo | os pontos de pouso e gatilhos que **todo** vault que executa aquele processo repete |

São destinos **diferentes**, e a distinção é o corte `_`/conteúdo: mecanismo é do produto, processo
é da empresa. Colapsá-los num destino só reintroduz no acervo da empresa o que pertence ao produto.

### 9.3 A declaração de herança

O vault declara **`processo:`** no frontmatter da própria `_cerebro/camada-1.md`. O mecanismo injeta
a carta de processo correspondente **uma vez por sessão — não uma vez por vault**.

**O processo declara `topologia:`** — a forma admissível do caminho das suas instâncias (ex.:
`projetos/{ciclo}/{projeto}`), e o vault declara na própria carta qual usa. É isto que a M7 verifica,
e **não** existência de pasta: vault que a fábrica acabou de provisionar não tem projeto, logo não tem
casa de ADR, de backlog nem de RNF — e essas casas nascem quando o projeto passa pelos refinamentos,
não no provisionamento. Reprovar o estado normal de nascimento contraria o invariante que este
contrato declara: *ausência é gatilho de nascimento, não erro*.

**Casa canônica da carta de processo:** `_cerebro/processos/{processo}.md`, **relativa à raiz do
vault que governa o processo** (nesta instância, a matriz). O nome do arquivo é o próprio valor de
`processo:` — derivável, nunca catalogado, pela mesma razão que o índice de entidades é derivado e
não autorado (§4).

| | Carta de navegação (`_cerebro/camada-1.md`) | **Carta de processo (`_cerebro/processos/{processo}.md`)** |
|---|---|---|
| Responde | por onde entro **neste vault** | onde as coisas deste processo moram em **qualquer** vault que o execute |
| Dono | quem governa aquele vault | quem governa o processo |
| Custo | uma por vault resolvido | **uma por sessão**, quantos vaults forem |
| Ausência | lacuna reportada | lacuna **só se** algum vault declarar `processo:` apontando para ela |

> **Não confundir com a metodologia.** A carta de processo é índice e gatilho (camada 1); o que o
> processo *é* — fases, cerimônias, papéis, critérios — é conteúdo denso, mora onde o coletivo
> declarar, e entra sob demanda. Colapsar os dois recria dentro da camada 1 o peso que ela existe
> para manter fora.

**Registro de injeção.** O mecanismo grava os processos já injetados em `.connect/heranca.json`, no
**workspace da sessão** — nunca em vault, nunca em memória do processo. Arquivo e não variável por
dois motivos medidos: o servidor MCP é longo-vivo e atende várias sessões (variável vazaria de uma
para outra), e pode reiniciar no meio de uma sessão (variável perderia o registro e a carta seria
cobrada de novo).

> **É a diferença entre poda e arquitetura.** Sem herança, o piso de contexto cobra uma carta cheia
> por vault resolvido, e escala linearmente com quantos vaults a sessão toca. Com herança, N vaults
> do mesmo processo pagam **uma** carta de processo mais N deltas pequenos.

**Ausência de `processo:` não é lacuna.** Vault que não declara processo não herda nada e a carta
local carrega tudo — o mecanismo degrada para o comportamento anterior a esta versão, sem quebrar.
Também não colhe benefício algum: é o limite conhecido da regra.

### 9.4 Métricas — a face de verificação do interior

Complementam a §5. As três primeiras existem porque o alcance (§8) tornou verificável o que antes
dependia de julgamento. **As sete rodam** — `lib/metricas.mjs`, expostas pela tool
`medir_navegacao`, consumidas pelo modo AUDIT. Nenhuma bloqueia.

| # | Métrica | Orçamento / critério | Resolve |
|---|---|---|---|
| **M1** | **Cobertura** — todo arquivo é coberto por uma declaração de nível na **corrente efetiva** (herdada + delta + o que cada hub declara). Não coberto = órfã | 0 órfãs · corrente sem quebra | Torna o **check 6** computável pela primeira vez. ⚠️ **Duas precondições duras, obedecidas no código:** resolver a herança é o passo 1, e percorrer a corrente é o passo 2 — sem a primeira, cada arquivo coberto pela carta de processo vira órfã falsa; sem a segunda, cada arquivo coberto por um hub vira órfã falsa |
| **M2** | **Grau de padrão** — todo nível é *derivável* ou *listável*; índice autorado só onde nenhum dos dois | grau declarado e coerente | Fecha listagem derivada × índice autorado (§8.1). Índice autorado sobre nível derivável ou listável é **reportado como defeito**, não como zelo |
| **M3** | **Massa da carta em tokens** ≤ orçamento, em **duas partes** com donos distintos | **delta local ≤ 1.400** · **carta de processo ≤ 2.000** | Substitui o **check 4**. A separação é de justiça, não de contabilidade: quem escreve a carta local não controla o processo herdado |
| **M4** | **Massa do caminho de entrada** (carta + `vault-config` + pouso declarado) ≤ orçamento | **≤ 4.000** | Novo — o pouso declarado pode custar sozinho mais que a carta, e ninguém media. Medido em 01/09: 27,1 KB num único nó de pouso |
| **M5** | **Ponteiro morto = 0**, incluindo os ponteiros da carta de **processo** resolvidos em cada vault que a herda | 0 mortos | Fecha o **check 3** e cobre o modo de falha novo que a herança cria: ponteiro válido no vault A e morto no vault B, sem que nenhum dos dois donos veja |
| **M6** | `## Fronteiras` nomeia **conceito**, nunca caminho nem URL | 0 violações | Fecha o **check 5** |
| **M7** | **Conformidade topológica** — a forma real do caminho casa com a `topologia:` que o processo declara | 0 divergências | Novo. Sem ela a herança quebra **em silêncio**: gatilho herdado que aponta para uma forma que aquele vault nunca usa não resolve nunca, com conteúdo ou sem. **Não** verifica existência de pasta — vault sem instância é conformante por construção, e a métrica volta a ter o que medir no primeiro projeto |

**Como os orçamentos de M3 e M4 foram escolhidos.** A v0.4.0 os deixou em branco de propósito —
calibrar sobre a carta de então seria calibrar sobre o conteúdo que a §9 remove. Fixados na v0.5.0,
depois da primeira carta de processo publicada: o **delta honesto do vault mais complexo, já podado,
mediu ~1.265 tokens**, e o teto é esse valor com ~10% de folga. Não foi escolhido para caber — foi
escolhido para **morder** no ponto em que a carta começa a reabsorver mecanismo e processo, que é o
defeito medido (poda de 26/08 desfeita em cinco dias, **+26%** sobre o ponto de partida). Teto
generoso não avisa nunca — foi o defeito das 250 linhas; teto apertado avisa sempre, e alarme
constante é alarme desligado.

> **Processo que não declara `topologia:`** deixa a M7 em *não aplicável*, com esse motivo declarado —
> processo que não restringe a forma do caminho admite qualquer uma, e não há incompatibilidade
> possível a reportar. Passar em silêncio seria a mesma lacuna com outro nome.
>
> **Uma topologia canônica, não um conjunto.** Admitir duas formas para o mesmo processo onera a carta
> para tratar exceção e deixa o produto sem resposta para *"onde mora um projeto?"*. Quando duas formas
> reais divergem, a decisão é padronizar — não acomodar as duas no contrato.
