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

## Camada 2 em detalhe — resolve-on-touch (disciplina obrigatoria)

Regra permanente da sessao inteira, nao um fluxo de uma execucao so. Aplica-se a TODA nota
aberta, esteja ela na matriz ou dentro de um sub-vault ja montado — recursivo, sem limite de
profundidade (grafo, D102, nao arvore).

1. **Tarefa nomeia um conceito** (projeto, cliente, area, tribo — termo literal do operador).
   Primeiro passo, sempre: chamar `resolver(conceito)`. **Nunca** grep, varredura de pastas ou
   adivinhacao como primeira tentativa — so como jamais. `resolver` casa por conceito exato,
   por gatilho (tag) ou substring; um termo comum (ex.: nome de um projeto que vive dentro de
   uma tribo) pode casar via tag da entidade-mae, sem precisar nomear a tribo.
2. **Toda nota aberta** (matriz ou sub-vault) que tiver `tipo` no frontmatter e um agente for
   seguir referencia dela: checar `externo`. Se `externo:true` e o sub-vault correspondente
   ainda nao estiver montado nesta sessao, `resolver` antes de seguir — nunca ler alem da
   fronteira sem resolver primeiro.
3. **Status devolvido pelo `resolver` dita a acao — nunca contorno:**
   - `sem-acervo-externo` — conteudo mora na propria matriz; seguir lendo normal.
   - `pendente-criacao` — entidade existe, acervo nao. Oferecer a `cnct-fabrica-<tipo>` ao
     operador; nunca criar nada sozinho.
   - `local-nao-configurado` — esta maquina nunca resolveu esse `conceito`. Perguntar ao
     operador o diretorio local, gravar com `registrar_subvault_local`, repetir o `resolver`.
   - `origem-ausente` — path conhecido mas nao existe/nao sincronizado. Avisar; nunca tentar
     outro caminho por adivinhacao.
   - `resolvido` — pedir acesso ao Cowork ao diretorio de origem, montar, e se houver
     `entrada`, pousar direto nessa nota (nunca tatear o diretorio procurando por onde comecar).
4. **Uma vez resolvido, o alias e conhecido pro resto da sessao.** Nao chamar `resolver` de
   novo pro mesmo `conceito`; navegacao dentro dele e path relativo normal
   (`./alias/estrutura/arquivo.md`), igual a navegacao dentro da matriz.
5. **Nenhum manifesto guarda path/url** (D35) — se um bloqueio parecer exigir adivinhar um
   diretorio, o bloqueio e sinal de configuracao local faltante (`local-nao-configurado`),
   nunca motivo para grep.

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
