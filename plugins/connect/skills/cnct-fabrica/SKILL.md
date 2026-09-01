---
name: cnct-fabrica
metadata:
  version: "0.1.0"
  eixo: nucleo
  program: "Impulsa / Viceri"
description: >
  A mente construtora do Connect — UMA fábrica genérica que materializa qualquer coisa que o
  coletivo declare como tipo: um processo, um papel, um glossário, uma política, ou um contexto
  inteiro do zero (tribo, cliente, squad, área, projeto), com os deltas e as arestas que o ligam
  ao resto do organismo. Dispara quando o operador diz "criar", "construir", "provisionar",
  "nascer", "montar do zero", "estruturar" seguido de qualquer entidade ou artefato — "criar o
  papel de QA", "montar o vault do cliente X", "estruturar o processo de Y", "provisionar a tribo
  Z" — e quando o mecanismo devolve `pendente-criacao` ao resolver um conceito. Não sabe o que é
  uma tribo nem o que é um papel: quem sabe é o coletivo, e ela lê. Nunca sobrescreve, nunca
  inventa tipo, e nunca declara pronto sem o mecanismo resolver o que nasceu.
---

# cnct-fabrica — a mente construtora

> **Uma fábrica, não uma por tipo.** O construtor é genérico; o *tipo* vem do coletivo alvo, e o
> *modo* se deduz da família do tipo — nunca se pergunta ao operador.
> Contratos: `config/contrato-tipos.md` (schema de tipo + handshake) · `config/contrato-manifesto.md`
> (fronteira) · `config/contrato-navegacao.md` (interior).

## Por que esta fábrica existe

Todo contexto novo desta instância — cada tribo, cada cliente, cada processo, cada papel — nasceu
**à mão**, por alguém que tinha o modelo na cabeça. Isso funciona exatamente até a primeira pessoa
que não tem, e a partir dali produz duas coisas: estrutura que diverge sem que ninguém decida
divergir, e artefato que existe em disco sem que ponteiro nenhum o alcance.

O produto **não pode** resolver isso prescrevendo a estrutura: o que é uma tribo, o que uma área
precisa ter, quais processos existem — tudo isso é conteúdo da empresa. O que o produto faz é
**exigir a declaração**, **conduzir a elicitação** do que falta, **materializar na forma declarada**
e **garantir que o mecanismo resolve o que nasceu**.

> **O viés a vencer é o do próprio construtor.** O agente tende a criar, porque artefato novo é
> visível e reuso não é. Medido: numa sessão real, três peças foram propostas e as três já existiam
> sob outro nome. Daí a ordem dos passos abaixo — **procurar antes de construir** não é cortesia, é
> o passo 2.

## Passo 0 — Pré-condições, verificadas na abertura (não descobertas no fim)

Antes da primeira pergunta ao operador, verificar e **dizer o resultado em voz alta**:

1. **Coletivo alvo resolvido?** `iniciar_sessao` + `resolver({conceito})`. Sem coletivo, só o tipo
   `operador` é construível (§ *Estado zero*); qualquer outro **para aqui**.
2. **O tipo pedido está declarado?** Ler a § *Estrutura mínima e herança* do
   `_cerebro/modelo-roteamento.md` da matriz do coletivo alvo. Tipo ausente → **não improvisar**:
   é lacuna do coletivo, e a saída é elicitar a declaração do tipo primeiro (§ *Tipo não declarado*).
3. **Se o alvo é um contexto: o processo que ele vai executar está declarado?** Um contexto é a
   projeção do processo que ele executa; sem processo declarado na matriz, a fábrica materializa
   apenas a camada de mecanismo e o resto nasce vazio. **Dizer isso ao operador agora**, com a
   opção de declarar o processo primeiro — descobrir no fim que o nascimento foi parcial é o modo
   de falha que o handshake proíbe.

> Pré-condição não satisfeita é **conversa no início**, nunca relatório no fim.

## Passo 1 — O que se está construindo, em linguagem do operador

Nunca perguntar *"isto é artefato ou contexto?"* nem *"que tipo de vault você quer?"* — são
classificações do mecanismo, e transferi-las ao operador é defeito de desenho. A fábrica **deduz**:

| O operador diz | A fábrica deduz | Família |
|---|---|---|
| "o papel de QA", "o processo de marketing", "o glossário da tribo", "a política de IA" | um item que vive **dentro** de um contexto | **artefato** |
| "o vault do cliente X", "a tribo Y", "a squad Z", "a área W", "o projeto K" | o **container** onde itens caem | **contexto** |

**As duas perguntas de abertura para um contexto**, e são estas porque são as que o operador
responde sem saber nada de mecanismo:

- *"Que processo este contexto executa?"* — é o que determina a topologia. Não é pergunta retórica:
  a resposta vira a estrutura, e um contexto que executa dois processos herda a forma dos dois.
- *"O que ele tem sob responsabilidade continuada?"* — produtos, sistemas, ativos, contratos. É o
  que distingue um contexto que só toca iniciativas de um que também opera.

## Passo 2 — Procurar a casa que já governa aquilo (antes de criar)

Obrigatório, e antes de qualquer materialização:

1. `resolver({conceito})` — a entidade já existe no grafo? `pendente-criacao` é gatilho de
   nascimento; `resolvido` significa que **existe**, e a sessão é de completar por delta, não de criar.
2. Procurar o artefato pelo **objeto**, não pelo nome que o operador usou — o mesmo objeto tem nomes
   diferentes em contextos diferentes, e foi assim que três peças foram propostas em duplicata.
3. Achou? **Apresentar o que existe e perguntar se é isto**, antes de oferecer construir. Reuso
   confirmado é entrega; criação por não ter procurado é dívida.

## Passo 3 — Ler a forma declarada, nas três camadas

A forma de um destino não é uma coisa só. São três, com donos diferentes, e a fábrica trata cada
uma com a regra dela:

| Camada | Quem declara | Onde a fábrica lê | Como ela trata |
|---|---|---|---|
| **1 · mecanismo** | o produto | `config/` deste plugin | materializa **sempre**, com o nome exato. Não negociável, não elicitado |
| **2 · processo** | o coletivo | `_cerebro/metodologias/` + § *Estrutura mínima e herança* do `modelo-roteamento` | materializa o que o processo declarado exige. **Não inventa**: processo sem forma declarada é lacuna reportada |
| **3 · contexto** | a própria unidade | elicitação com o operador | materializa o que o operador declarar, e **escreve o gatilho de cada item na carta** |

**Camada 1, sempre e literalmente:** `_cerebro/camada-1.md` · `_cerebro/vault-config.md` (com a
topologia declarada: `matriz` ou `sub-vault`, conjunto fechado) · `_inteligencia/skills/vault-write/vault-write.md`
· `_inteligencia/skills/vault-audit/vault-audit.md` · `_automacoes/vault-audit/issues.md`. Os
executores leem esses caminhos literalmente — variar o nome aqui quebra entre vaults.

**Scaffold aponta, nunca copia.** A forma canônica de cada artefato vive nos templates do coletivo
(`99 - Templates e Modelos Globais/`, índice no `README.md` da pasta). A fábrica **resolve o template
lá** e preenche. Molde embutido nesta skill seria a terceira cópia da mesma forma, e a que apodrece
primeiro — é a razão de esta fábrica não ter pasta `templates/`.

## Passo 4 — Elicitar o que falta (uma pergunta por vez, cada uma dizendo por que importa)

O banco de perguntas por tipo **não mora aqui** — mora no knowledge do coletivo
(`_inteligencia/skills/cnct-fabrica/cnct-fabrica.md`), porque as perguntas que funcionam são as que
já funcionaram naquela casa. Ler o banco do tipo alvo antes de perguntar.

- **Se a leitura do vault já responde, não pergunte** — apresente a resposta encontrada para
  ratificação. Perguntar o que está escrito ensina o operador que a fábrica não leu.
- **Tipo sem banco não bloqueia.** Cada item da estrutura mínima declarada vira uma pergunta, e a
  lacuna de banco é reportada no fim. É por essa porta que o banco cresce.
- **Uma pergunta por vez**, com uma linha do porquê. Bateria de perguntas produz resposta educada e
  estrutura errada.
- **Nome próprio nunca vai para campo estrutural.** Quem ocupa, quem responde, quem é o ponto focal
  é dado do coletivo e vive onde ele declara — não no artefato que está nascendo.

## Passo 5 — Materializar (nunca sobrescrever)

1. Carregar o protocolo de escrita do vault alvo (`cnct-nucleo-escrita`) — o que nasce é conteúdo
   daquele vault e obedece às regras dele.
2. Escrever a partir do template resolvido no Passo 3. **Seção sem resposta ratificada não entra
   vazia**: fica de fora e é reportada como lacuna. Estrutura decorativa é pior que estrutura
   ausente, porque parece completa.
3. **Ausência é gatilho de nascimento; presença é gatilho de conferência.** Estrutura existente é
   completada por delta — o que já está lá é fonte, não rascunho.
4. Do ponto de vista do operador, o nascimento é **atômico**: se um passo falhar, reportar o estado
   parcial nomeando o que ficou pendente. Nunca silenciar.

## Passo 6 — O handshake: fazer o mecanismo enxergar o que nasceu

> **A fábrica não termina quando escreve o último arquivo. Termina quando o mecanismo resolve o que
> ela criou.** Materializado ≠ alcançável.

**Família `contexto` — três passos, nesta ordem:**

1. **Manifesto na matriz** — a nota da entidade com `tipo`/`papel`/`externo`/`conceito`/`alias`/`entrada`,
   e a aresta declarada **nos dois lados**. Aresta de um lado só é meio grafo, e o lado que falta é
   sempre o que alguém vai procurar.
2. **`registrar_subvault_local(conceito, caminho)`** — o path é por-máquina e mora só no
   `connect.config.json`, nunca no vault. Duas entidades que compartilham um acervo precisam de
   **um registro cada**: o índice é por conceito, não por alias.
3. **Carta de navegação + `vault-config.md`** — sem elas o acervo monta e o agente não sabe navegar.
   Delegar a `cnct-fabrica-navegacao` é legítimo; pular não é.

**Família `artefato` — dois passos:**

1. **Estrutura mínima materializada** no destino que o roteamento declara.
2. **Linha na tabela `## Quando carregar`** da carta do vault, ligando o gatilho ao artefato — e
   linha no índice/hub daquele tipo, quando houver. **Este é o passo que nada declarava antes.** Um
   artefato sem gatilho existe e é inalcançável: nasce órfão, e a fábrica que o produziu criou
   trabalho e escondeu a causa.

## Passo 7 — Verificar de verdade (não declarar sucesso)

1. **Contexto:** chamar `resolver(conceito)` e **exigir `status: resolvido` com zero avisos**.
   Qualquer outro status é nascimento incompleto, reportado com o passo que faltou.
2. **Artefato:** reabrir a carta do vault e confirmar que o gatilho novo está lá e aponta para um
   caminho que existe. Ponteiro morto é pior que ausência — custa uma leitura e ensina a desconfiar
   do índice.
3. Rodar `cnct-nucleo-audit` no vault tocado e conferir que a construção **não abriu issue nova**.
4. Reportar: o que foi materializado, o que foi reusado, as lacunas remanescentes (de banco, de
   forma de processo, de resposta não ratificada) e o resultado do handshake.

## Estado zero — a exceção declarada, não descoberta

Tipo cujo nascimento **precede a existência de qualquer coletivo** é declarado no `config/` deste
plugin, nunca no roteamento — não há roteamento para ler. Hoje qualifica **exatamente um**:
`operador`. Ele roda sem coletivo montado, é self-contained no executor, e a lista **não cresce por
conveniência**: só entra quem passar no teste de §2 do `contrato-tipos.md`.

## Tipo não declarado — o que fazer

Tipo pedido que a matriz do coletivo não declara **não se improvisa**. A saída é elicitar a
declaração primeiro: nome · família · estrutura mínima · semântica de descida (`delta` ·
`exigência-e-resposta` · `não desce`) · forma canônica (ponteiro para o template) · handshake. São
os seis campos do schema, e a fábrica **recusa nomeando o campo faltante** em vez de supri-lo. Isso
é uma sessão de governança curta, não um bloqueio: declarado o tipo, a construção segue na mesma
sessão.

## Modo migração — contexto que já existe fora do produto

Nascer não é o único caso, e o mais comum na prática é o outro: uma casa que já existe e precisa
virar contexto governado. A fábrica **não recria e não move conteúdo por conta própria**:

1. **Inventariar antes** — o que existe hoje, e o que deixaria de existir se a migração acontecesse.
   Migração sem inventário perdeu conteúdo três vezes nesta instância, e nas três ninguém percebeu
   na hora.
2. **Diferenciar** o que já satisfaz a forma do que diverge, item a item, com o diff na mesa.
3. **A origem não é apagada.** Ela vira histórico declarado, com quem resgata e quando — e enquanto
   as duas casas coexistirem, quem escreve confirma o alias antes.

---

> Regras de mecanismo que sustentam esta fábrica (ver `GLOSSARIO.md`):
> `corte-mecanismo-conteudo`, `gatilho-de-nascimento`, `vault-declara-produto-nao-prescreve`,
> `carregamento-lazy`, `ponteiro-tipado`, `bloqueio-reporta-nunca-contorna`.
> Contratos: `config/contrato-tipos.md` (schema e handshake) · `config/contrato-manifesto.md` ·
> `config/contrato-navegacao.md`.
> Banco de perguntas e lista de tipos: **do coletivo**, nunca deste plugin.
