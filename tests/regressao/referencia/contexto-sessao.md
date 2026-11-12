## Connect — confira o canal injetado (matriz)

Este vault publica governanca com o marcador `CNCT-GOV-matriz`.
**Procure esse marcador no seu proprio contexto.** Se ele NAO estiver la, esta pasta nao
esta conectada ao projeto Cowork — e a camada 1 depende de um arquivo que pode nao abrir,
que e a falha medida em 26/08. Ofereca ao operador conectar a pasta; e uma pasta so.

## Connect — acesso de pasta (faca isto primeiro)

🔑 Solicite ao operador acesso a **uma** pasta: `<RAIZ>/home/Connect`
Ela o harness precisa de acesso concedido a esta pasta — ela alcanca o workspace da sessao e o estado do operador.
Com ela concedida, ficam alcancaveis: `./matriz`, `./operador`.


⚠️ **Uma concessao pode nao bastar.** O harness aplica politica de acesso sobre o
**destino real** da junction, nao sobre o link — e destino sincronizado por OneDrive
costuma exigir concessao propria (medido em 24/08). Se um alias abaixo nao abrir,
solicite a origem correspondente; nao contorne, nao adivinhe outro caminho:
- `./matriz` -> `<RAIZ>/Matriz`
- `./operador` -> `<RAIZ>/home/Connect/operador`

**Se um caminho declarado nao abrir, reporte a lacuna — nao contorne.** Varredura de
sistema de arquivos, `grep` exploratorio e ferramenta de automacao de SO para ler vault
sao contorno: mascaram o defeito em vez de corrigi-lo e produzem resposta
errada a partir de nota que so o grep acha — que e, por definicao, nota orfa.

## Connect — sessao iniciada

Workspace da sessao: `<RAIZ>/home/Connect/sessions/regressao-cowork`

### Operador
- Nome: Operadora de Regressao
- E-mail: regressao@exemplo.com
- Papeis: Dev

### Atalhos montados
- `./matriz` -> `<RAIZ>/Matriz` (link)
- `./operador` -> `<RAIZ>/home/Connect/operador` (link)

### Regras duras desta sessao (nao negociaveis)
1. Referencie conhecimento por caminho relativo ao workspace — nunca por caminho absoluto de maquina.
2. Mount da junction da o caminho estavel; ele NAO concede leitura. Se um caminho declarado nao abrir, PECA a concessao ao operador — varredura, `grep` exploratorio e automacao de SO sao contorno, nao alternativa.
3. `resolver` e para conceito com casa FORA da matriz — sub-vault (cliente, tribo, area com acervo) ou diretorio de entrega (Delivery Hub). Projeto, nota ou entidade que mora na matriz ou num vault ja montado: carta de navegacao + wikilink, lazy. Nunca comece por glob/grep.
4. Dentro de um vault, navegue na ordem: carta de navegacao -> ponto de pouso declarado -> ponteiro declarado. Varredura e ultimo recurso e DEIXA MARCA (reporte).
5. Antes de criar ou editar arquivo em qualquer vault, carregue o protocolo de escrita (`cnct-nucleo-escrita`). Nao pule, mesmo com destino obvio.

### Camada 1 e protocolo completo
- Carta de navegacao da matriz: `_cerebro/camada-1.md` na pasta da matriz (conectada ao
  projeto; tambem em `./matriz/_cerebro/camada-1.md`). Leia antes de navegar no vault.
- Contexto distante, ou carta inalcancavel: chame a tool `iniciar_sessao` — ela devolve o
  protocolo do mecanismo, a carta verbatim e esta camada 0 pelo canal da tool.

### Perfil do operador — camada 0

# Camada 0 da operadora

Preferencia pessoal de teste.
