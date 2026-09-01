---
name: cnct-elicitacao
metadata:
  version: "0.1.0"
  eixo: nucleo
  program: "Impulsa / Viceri"
description: >
  O par da `cnct-fabrica`: captura passiva de COMO se constrói, para que a próxima construção do
  mesmo tipo comece adiantada. Observa qualquer sessão de trabalho do coletivo — não só as de
  estruturação — e destila o que foi decidido, o que foi perguntado e o que funcionou em insumo
  estruturado que a fábrica lê como banco de elicitação por tipo. Roda em silêncio, sem
  acionamento. Sob demanda, responde a "destila o que aprendemos", "atualiza o banco de
  elicitação", "o que já sabemos sobre construir X", "gera o dossiê de caso-zero". Nunca cruza a
  fronteira do coletivo: o que se aprende numa matriz fica nela.
---

# cnct-elicitacao — o Connect aprende a construir com quem constrói

> **Par da `cnct-fabrica`, e a razão de ela melhorar sozinha.** A fábrica sabe *como se constrói
> qualquer coisa*; esta skill é o que faz o coletivo saber *o que perguntar* para cada tipo. Uma
> constrói, a outra aprende com a construção — e o que ela aprende volta como pergunta melhor na
> vez seguinte.

## O problema que ela fecha

Um coletivo constrói um processo, um papel, uma tribo. As perguntas certas foram feitas, o
raciocínio aconteceu, a estrutura nasceu — e **tudo isso evapora com a sessão**. A próxima pessoa
que for construir a mesma coisa começa do zero, faz perguntas piores, e produz uma estrutura que
diverge sem que ninguém tenha decidido divergir.

O que sobrevive hoje é o *resultado* (o arquivo que nasceu). O que se perde é o *método* — e é o
método que o produto promete escalar. **Sem esta captura, a fábrica nunca fica melhor do que na
primeira vez que rodou.**

> **Por que passiva.** Sessão de entrevista para capturar método é cara demais para acontecer, e
> quando acontece produz resposta ensaiada. O conhecimento de como alguém constrói se colhe
> **enquanto ele constrói** — de graça, no meio do trabalho que ele ia fazer de qualquer jeito.

## O que ela observa

**Qualquer sessão de trabalho do coletivo**, não só as de estruturação de vault. A construção
acontece disfarçada de outra coisa: um refinamento decide a forma de um artefato, uma daily revela
o gate que ninguém tinha declarado, uma conversa sobre um cliente destila o corte do acervo dele.

| Sinal na sessão | O que vira |
|---|---|
| Pergunta do agente que **destravou** o operador (ele respondeu com densidade, não com "sei lá") | entrada no banco de elicitação daquele tipo, com o motivo de ela funcionar |
| Pergunta que **produziu resposta educada e vazia** | anti-pergunta declarada — vale tanto quanto a que funcionou, e ninguém registra |
| Decisão de estrutura **com o rationale junto** | célula de estrutura mínima candidata, com o caso que a justificou |
| Correção do operador sobre o enquadramento do agente | **viés de arquitetura da casa** — é o sinal mais valioso (§ abaixo) |
| Norma que emergiu no meio do trabalho, com o gatilho que a dispara | candidata a subir para o processo, com evidência de uso |
| Armadilha em que a sessão caiu, e como saiu | linha na tabela de armadilhas daquele tipo |
| Reuso que quase não aconteceu (o agente ia criar o que já existia) | sinal de que falta ponteiro, não que falta artefato |

## O viés de arquitetura — o que só se colhe observando

Toda pessoa que constrói carrega um jeito de cortar o problema, e ele aparece **nas correções**, não
nas afirmações. Quando o operador rejeita um enquadramento — *"não é isso que eu quis dizer"*,
*"por que você foi por aí?"*, *"isso está no eixo errado"* — o que está sendo dito é uma regra de
arquitetura que ele nunca escreveria como regra, porque para ele é óbvia.

Capturar isso é o que permite ao Connect **antecipar opções concretas** em vez de fazer perguntas
abertas: em vez de *"como você quer estruturar isso?"*, oferecer as duas ou três formas que já
funcionaram nesta casa, com o trade-off de cada uma dito em uma linha.

- Registrar a **correção e o que ela corrigiu**, nunca só a conclusão. A conclusão sem o desvio que
  ela corrigiu não ensina nada.
- Distinguir **preferência de uma pessoa** de **norma do coletivo**: a primeira vira nota de estilo
  daquele operador; a segunda, candidata a norma — e a diferença é se um segundo operador entrando
  amanhã leria aquilo como verdade sem tradução.
- **Nem toda pessoa tem viés de arquiteto, e isso também é dado.** Operador que aceita a primeira
  proposta sem corrigir não está confirmando que ela é boa — está sinalizando que precisa de opções
  mais concretas, não de perguntas mais abertas.

## Como o que se aprende volta para a fábrica

O destino da captura **não é um relatório**. É o banco de elicitação por tipo, no knowledge do
coletivo (`_inteligencia/skills/cnct-fabrica/cnct-fabrica.md`), que é exatamente o arquivo que a
`cnct-fabrica` lê no Passo 4 antes de perguntar qualquer coisa.

**Regra de promoção — o que sobe e quando:**

- **Perguntas e movimentos:** sobem ao aparecer em **≥ 2 construções**. Uma vez é caso; duas é
  padrão. O que apareceu uma vez fica na captura, disponível e não promovido.
- **Armadilhas:** sobem **na primeira ocorrência**. Assimetria deliberada — o custo de repetir um
  erro é maior que o de registrar um caso isolado.
- **Estrutura mínima:** **nunca sobe sozinha.** Ela é declaração de governança, e vai como
  *proposta ao operador* com o caso que a sugeriu. Deixar a captura escrever forma canônica seria
  transformar prática acidental em norma pelas costas de quem governa.
- **Toda promoção passa pelo operador com o diff na mesa.** Aprendizado silencioso que vira norma
  silenciosa é a forma mais cara de errar.

## Fronteira — o que ela nunca faz

- **Não cruza coletivo.** O que se aprende numa matriz fica nela. Método destilado carrega o
  contexto de onde nasceu, e método de um cliente aplicado a outro é vazamento com cara de
  aprendizado.
- **Não captura conteúdo, captura forma.** O *que* foi decidido é do acervo; o *como se chegou* é
  desta skill. Quando os dois se confundem, o teste é: isto ajudaria alguém a construir **outra**
  coisa do mesmo tipo? Se não, é conteúdo.
- **Nunca dado sensível.** Nome de pessoa, credencial, dado de cliente não entram — nem como
  exemplo. O piso de classificação do vault alvo bloqueia a escrita, e não é oferecido como opção.
- **Não interrompe.** Nada é anunciado durante a sessão. Captura que pede atenção deixa de ser
  barata, e captura cara não acontece.
- **Não é o encerramento.** O `cnct-nucleo-encerramento` consolida o que a sessão produziu; esta
  aprende como a sessão produziu. Ela é **chamada por** ele, e não disputa os gatilhos dele.

## Modos

**Passivo (padrão, sem acionamento).** Durante a sessão, manter os sinais em observação. No
encerramento — chamada por hook do `cnct-nucleo-encerramento` — escrever a captura da sessão em
`{projeto}/caso-zero/{AAAA-MM-DD}-{slug}.md` e a linha no índice. Nada durante; tudo no fim.

**Destilar (sob demanda).** *"destila o que aprendemos"*, *"atualiza o banco de elicitação"*.
Ler as capturas, aplicar a regra de promoção, apresentar o diff, e só então escrever no knowledge
do coletivo.

**Consultar (sob demanda, e é o modo que a fábrica usa).** *"o que já sabemos sobre construir X"*.
Devolve, para um tipo: as perguntas que funcionaram, as anti-perguntas, as armadilhas e as formas
já adotadas nesta casa com o trade-off de cada uma. É o que transforma elicitação aberta em escolha
informada.

**Dossiê (sob demanda).** *"gera o dossiê de caso-zero"*. Monta o artefato de evidência a partir das
capturas. Apresentar para revisão antes de salvar; nunca salvar antes da aprovação.

## Precedência sobre a skill anterior

Esta skill **substitui** a `elicitacao-captura` instalada fora do plugin. Duas skills com gatilhos
sobrepostos produzem seleção não-determinística — o defeito de *"às vezes dispara, às vezes não"*
já medido nesta instância com outro par. Ao detectar a antiga instalada, **reportar ao operador e
não rodar as duas**: o inventário instalado é responsabilidade do entregador de skill, e desabilitar
por decisão registrada em vault não alcança a máquina de ninguém.

---

> Regras de mecanismo que sustentam esta skill (ver `GLOSSARIO.md`):
> `corte-mecanismo-conteudo` (o executor viaja no plugin; o banco é do coletivo),
> `vault-declara-produto-nao-prescreve`, `carregamento-lazy`,
> `bloqueio-reporta-nunca-contorna`.
> Par: `skills/cnct-fabrica/SKILL.md`. Destino do que ela destila:
> `_inteligencia/skills/cnct-fabrica/cnct-fabrica.md` do coletivo.
