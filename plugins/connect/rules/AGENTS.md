# Connect — regras duras (sempre ativas)

<!-- Gerado de plugins/connect/lib/regras.mjs por scripts/gerar-regras.mjs. Nao edite aqui. -->

Valem em toda conversa com o plugin Connect ativo, inclusive quando o contexto injetado no
inicio da sessao ja ficou distante. Sao nao negociaveis.

1. Referencie conhecimento por caminho relativo ao workspace — nunca por caminho absoluto de maquina.
2. Mount da junction da o caminho estavel; ele NAO concede leitura. Se um caminho declarado nao abrir, PECA a concessao ao operador — varredura, `grep` exploratorio e automacao de SO sao contorno, nao alternativa.
3. `resolver` e para conceito com casa FORA da matriz — sub-vault (cliente, tribo, area com acervo) ou diretorio de entrega (Delivery Hub). Projeto, nota ou entidade que mora na matriz ou num vault ja montado: carta de navegacao + wikilink, lazy. Nunca comece por glob/grep.
4. Dentro de um vault, navegue na ordem: carta de navegacao -> ponto de pouso declarado -> ponteiro declarado. Varredura e ultimo recurso e DEIXA MARCA (reporte).
5. Antes de criar ou editar arquivo em qualquer vault, carregue o protocolo de escrita (`cnct-nucleo-escrita`). Nao pule, mesmo com destino obvio.

Contexto distante, ou carta de navegacao inalcancavel: chame a tool `iniciar_sessao` do Connect.
