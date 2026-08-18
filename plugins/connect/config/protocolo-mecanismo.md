# Protocolo do mecanismo Connect

> Espinha dorsal do dois-cerebros. Entregue e mantida pelo **produto** (mecanismo, nao
> conteudo da empresa — corte `_`/conteudo, D96). Injetada no contexto no inicio de toda
> sessao pelo hook `SessionStart` — a garantia de execucao e estrutural: nao depende de o
> operador manter arquivo nenhum, nem de o agente escolher ler um `CLAUDE.md`.

## Resolucao lazy em camadas

Carregar o minimo por padrao; a densidade entra **sob demanda**, disparada pela mencao
especifica de um projeto/produto/decisao — nunca por precaucao (ADR-6).

- **Camada 0** — identidade do operador + este protocolo. Sempre, custo ~zero.
- **Camada 1** — a **carta de navegacao** do vault (`_cerebro/camada-1.md`): identidade do coletivo + "onde encontrar o que" + o que carregar so por gatilho. **Declarada pelo vault**, injetada verbatim; nunca prescrita pelo produto (D98). Toda sessao com vault montado — matriz e cada sub-vault resolvido.
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
   - `resolvido` — pedir acesso ao Cowork ao diretorio de origem; ler a **carta de navegacao**
     que vem no bloco de resolucao e pousar em `entradaResolvida.caminhoRelativo` (nunca tatear
     o diretorio procurando por onde comecar). Se a carta vier ausente ou a `entrada` tiver sido
     resolvida por busca, isso e **lacuna do vault** — reportar, nao contornar em silencio.
4. **Uma vez resolvido, o alias e conhecido pro resto da sessao.** Nao chamar `resolver` de
   novo pro mesmo `conceito`; navegacao dentro dele e path relativo normal
   (`./alias/estrutura/arquivo.md`), igual a navegacao dentro da matriz.
5. **Nenhum manifesto guarda path/url** (D35) — se um bloqueio parecer exigir adivinhar um
   diretorio, o bloqueio e sinal de configuracao local faltante (`local-nao-configurado`),
   nunca motivo para grep.

## Ordem de resolucao canonica — como se acha uma nota (nao negociavel)

Montar um acervo nao e o mesmo que saber navega-lo. A ordem abaixo e a garantia de que
conhecimento e alcancado por **caminho declarado**, nunca por sorte de varredura. Vale para
a matriz e para todo sub-vault, do primeiro ao ultimo salto.

1. **Conceito -> `resolver`.** Nunca comece por grep/glob/varredura de pasta. O `status`
   devolvido dita a acao (secao acima).
2. **Camada 1 do vault -> a carta de navegacao** (`_cerebro/camada-1.md`, contrato em
   `config/contrato-navegacao.md`). E o vault que declara o que carregar, quando, e o que
   e peca pesada. O mecanismo injeta a carta verbatim; **o produto nao prescreve ponteiro
   nenhum** (D98). Vault sem carta = lacuna anunciada + fabrica oferecida (`cnct-fabrica-navegacao`),
   nunca ponteiro inventado.
3. **Ponto de pouso.** Abra a nota que o manifesto declara em `entrada` (caminho relativo ao
   acervo) antes de qualquer outra coisa naquele acervo. Sem `entrada`, o ponto de pouso e o
   que a carta indicar em "Ordem de entrada".
4. **Salto por ponteiro declarado.** Da nota aberta, siga so `[[wikilink]]`, tabela de
   gatilho da carta, ou ponteiro tipado. Cada salto e explicito e explicavel.
5. **Fronteira -> volta ao passo 1.** Nota com `tipo` + `externo:true`, ou item listado em
   "Fronteiras" da carta: `resolver` o conceito antes de seguir. Nunca leia alem da fronteira
   sem resolver.
6. **Varredura e ultimo recurso e DEIXA MARCA.** Se nada dos passos 2-5 alcancar o que a
   tarefa exige, a varredura e permitida — e obrigatoriamente **reportada** ao operador com o
   que foi buscado e o que se achou. Motivo: uma nota que so o grep acha e, por definicao,
   uma **nota orfa** — nenhum hub a linka. O achado nao e "encontrei", e **defeito do vault**:
   registre como issue (nota orfa / carta incompleta / `entrada` sem caminho) para o
   `vault-audit`. Contorno silencioso e o modo de falha que apaga o defeito (D108).

> Consequencia pratica: "nao sei onde isso mora" nunca autoriza tatear diretorio. Autoriza
> uma de tres coisas — `resolver` o conceito, ler a carta, ou **perguntar ao operador**.

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
