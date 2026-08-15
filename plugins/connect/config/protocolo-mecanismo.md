# Protocolo do mecanismo Connect

> Espinha dorsal do dois-cerebros. Entregue e mantida pelo **produto** (mecanismo, nao
> conteudo da empresa — corte `_`/conteudo, D96). Injetada no contexto no inicio de toda
> sessao pelo hook `SessionStart` — a garantia de execucao e estrutural: nao depende de o
> operador manter arquivo nenhum, nem de o agente escolher ler um `CLAUDE.md`.

## Resolucao lazy em camadas

Carregar o minimo por padrao; a densidade entra **sob demanda**, disparada pela mencao
especifica de um projeto/produto/decisao — nunca por precaucao (ADR-6).

- **Camada 0** — identidade do operador + este protocolo. Sempre, custo ~zero.
- **Camada 1** — verdades globais da matriz (governanca, "onde encontrar o que"). Toda sessao com matriz montada.
- **Camada 2** — comportamento: ao nomear um projeto/produto/decisao, descer direto na nota-fonte; resolver o sub-vault sob demanda (`resolver`), montando manifesto + acervo so no toque.
- **Camada 3** — artefato de entrega da task + backlog do projeto. So dentro da task.

## Regra de escrita

- Todo arquivo escrito ou atualizado no vault ganha `[[wikilinks]]` para os arquivos mencionados.
- Nota nova e linkada de pelo menos uma existente — nunca criar nota solta (sinapse morta).
- Referenciar conhecimento por **caminho relativo ao workspace**, nunca por caminho absoluto de maquina.
- Antes de escrever no coletivo, carregar o protocolo `vault-write` do coletivo ativo.
- Ponteiro e **tipado**: `[[wikilink]]` so para nota deste vault; artefato externo -> path nomeando a natureza; fato derivavel (path de mount, vault ativo) -> resolver, nao apontar (D35).

## Calibracao de interacao — identificador nunca vem sozinho

Todo identificador apresentado ao operador (ADR-N, Pxx, CAxx, Dxx, RNF-N, codigos de gate)
vem com **uma linha de descricao** — o que e e por que importa aqui. Confirmacao que exige o
operador abrir a fonte para entender do que se trata nao e confirmacao, e adiamento.

## Antes de tocar codigo

Ao mencionar ou investigar codigo, resolver o repositorio e conecta-lo direto — sem perguntar
o caminho ao operador nem pedir reconexao a toa.

## Check de atualizacoes

No inicio da sessao, comparar as atualizacoes pendentes do coletivo ativo com o que ja foi
aplicado; havendo pendencia, **oferecer** aplicar — nunca aplicar sem confirmacao.
