# Connect — Glossário de comportamento do produto

> Este arquivo é a fonte de "por que o mecanismo se comporta assim" para **qualquer instalação** do
> Connect — viaja com o plugin, não com o vault Impulsa. Cada entrada: nome descritivo → regra em uma
> frase → por que importa em uma frase. Sem código de ADR/decisão aqui de propósito: quem quiser a
> arqueologia completa (data, incidente, quem decidiu) encontra no log de ADR do produto, que é
> conteúdo de engenharia interna e não precisa ser resolvido por quem só está usando o Connect.
>
> Convenção: texto operante (protocolo, SKILL.md, templates) cita o **nome desta lista**, nunca um
> código cru (`Dxx`/`ADR-N`/`Pxx`). Se uma entrada crescer além de 2 frases, ela virou documentação de
> verdade — mover para `FRAMEWORK.md`/`CONCEITOS.md` e deixar aqui só o ponteiro.

## espinha-e-mecanismo

**Regra:** o protocolo de sessão (camadas, escrita, calibração de identificador) sempre vem do
mecanismo do produto (`config/protocolo-mecanismo.md`, injetado pelo hook) — nunca é copiado ou
reescrito dentro do `CLAUDE.md` do operador ou de um vault.
**Por que importa:** se cada vault reescrevesse a espinha à sua maneira, toda atualização do produto
exigiria editar vault por vault; mantendo-a só no mecanismo, uma correção do produto chega a todo
mundo na próxima sessão, sem reinstalar nada.

## corte-mecanismo-conteudo

**Regra:** pasta com prefixo `_` (`_cerebro/`, `_inteligencia/`, `_automacoes/`) é mecanismo (entregue
pelo produto); pasta sem `_` (`projetos/`, `organizacao/`, Delivery Hub) é conteúdo da empresa/cliente.
**Por que importa:** é o critério que decide, sem ambiguidade, se algo pertence ao plugin (viaja pra
todo cliente) ou ao vault de um cliente específico (fica só ali).

## gatilho-de-nascimento

**Regra:** um vault, taxonomia ou perfil que ainda não existe não é erro — é o sinal de que a fábrica
correspondente deve ser oferecida ao operador para materializá-lo.
**Por que importa:** evita duas falhas opostas: parar em silêncio (o operador não sabe o que fazer) ou
inventar uma estrutura no chute (o operador herda uma forma que ninguém decidiu).

## ponteiro-tipado

**Regra:** todo ponteiro declara a natureza do que aponta — `[[wikilink]]` só entre notas do mesmo
vault; artefato externo (repo, planilha, doc) vira path nomeando o que é; um fato que pode ser
derivado (path de mount, vault ativo) nunca é escrito à mão — é resolvido.
**Por que importa:** um wikilink que na verdade aponta pra fora do vault, ou um path copiado que podia
ter sido resolvido, são exatamente o tipo de referência que quebra quando outra pessoa (sem o mesmo
setup local) tenta seguir.

## vault-declara-produto-nao-prescreve

**Regra:** o produto declara a **exigência** (que todo vault tenha carta de navegação, manifesto,
taxonomia); o vault declara o **como** — quais eixos, quais pastas, quais gatilhos.
**Por que importa:** é o que permite o mesmo mecanismo servir uma seguradora e uma tribo de
engenharia sem que nenhuma das duas herde o organograma da outra.

## manifesto-e-acervo

**Regra:** toda entidade (tribo, cliente, projeto, operador) tem duas partes — o **manifesto**, leve,
no frontmatter da nota que a declara, dizendo que ela existe e quem a governa; e o **acervo**, pesado,
no diretório que cada operador informa na própria máquina.
**Por que importa:** separar as duas é o que deixa a entidade visível para todo mundo sem obrigar
todo mundo a ter acesso ao conteúdo dela — a falha de acesso vira resposta ("existe, você não
alcança, procure quem governa") em vez de silêncio.

## grafo-nao-arvore

**Regra:** as entidades formam um **grafo** de relações declaradas, não uma árvore de pastas: um
cliente atendido por duas tribos tem **um** manifesto e duas arestas, e toda aresta é declarada nos
**dois** lados.
**Por que importa:** forçar árvore obriga a duplicar a entidade em cada galho, e as cópias divergem —
que é o defeito que o modelo existe para não ter.

## path-por-maquina

**Regra:** nenhum caminho de disco (nem relativo, nem URL) é escrito no conhecimento coletivo — ele
vive só na configuração local de cada operador e é **resolvido** em runtime.
**Por que importa:** caminho é a única coisa num vault compartilhado que é verdade para uma máquina e
mentira para todas as outras.

## bloqueio-reporta-nunca-contorna

**Regra:** quando um caminho declarado não abre, as três saídas legítimas são reportar ao operador,
oferecer a correção declarada e registrar a issue — nunca achar o conteúdo por outro meio (varredura,
`grep` exploratório, automação de sistema operacional).
**Por que importa:** o contorno entrega uma resposta e **apaga o defeito**, então o mesmo bloqueio
volta na sessão seguinte, agora sem sinal nenhum de que existe.

## carregamento-lazy

**Regra:** o contexto carrega em camadas e só desce ao conteúdo específico quando um gatilho da
sessão pede — nunca por precaução.
**Por que importa:** é de onde vem a economia de contexto do produto; carregar "para o caso de
precisar" gasta o orçamento inteiro antes da primeira pergunta.

## canal-injetado-governado

**Regra:** o harness carrega sozinho o `CLAUDE.md` da raiz de toda pasta conectada e o rotula como
*override* — precedência acima do que o mecanismo injeta; por isso esse arquivo é publicado pelo
próprio Connect, com marcador `CNCT-GOV`, contendo **governança e ponteiro**, nunca a carta em si.
**Por que importa:** é o slot de maior precedência do contexto. Deixá-lo vazio significa que qualquer
pessoa com escrita naquela pasta compartilhada escreve instrução de autoridade máxima na sessão de um
colega, que não executou passo nenhum para recebê-la.

## curadoria-pessoal-coletivo

**Regra:** antes de escrever, classificar: é fato válido para **qualquer** operador que toque este
coletivo, ou é a leitura/urgência/próximo passo de **um** operador? Fato vai para o acervo; leitura
pessoal vai para o registro de vínculo daquele operador — nunca fundidas, nunca descartada.
**Por que importa:** teste prático — se a frase precisa de *"quem sou eu"* para fazer sentido, ela
apodrece no acervo e some quando a pessoa troca de projeto.

## preparar-e-parar

**Regra:** o mecanismo deixa a mudança pronta e para; publicar, commitar e validar é ato do operador.
**Por que importa:** quem responde pelo que entrou é quem tem o contexto que o agente não tem — e
automatizar o último passo transfere a responsabilidade sem transferir o contexto.

## indice-e-espelho

**Regra:** qualquer índice de vaults/entidades é derivado dos manifestos (frontmatter) — nunca uma
lista mantida à mão em paralelo.
**Por que importa:** duas fontes da mesma informação divergem com o tempo; derivar de uma fonte única
evita o índice ficar desatualizado em relação ao que realmente existe.
