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

## indice-e-espelho

**Regra:** qualquer índice de vaults/entidades é derivado dos manifestos (frontmatter) — nunca uma
lista mantida à mão em paralelo.
**Por que importa:** duas fontes da mesma informação divergem com o tempo; derivar de uma fonte única
evita o índice ficar desatualizado em relação ao que realmente existe.
