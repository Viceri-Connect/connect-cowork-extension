## Connect — sessao na nuvem

Esta sessao roda no servidor; o Connect (configuracao, matriz, perfil do operador) mora no
computador do operador e e alcancado pelas tools do Connect expostas pela ponte do app
desktop (o nome delas contem `connect`; podem estar diferidas — carregue-as).

**Nao trate como 1o uso.** Este hook nao enxerga o estado do operador, entao NAO afirma que
a matriz falta nem que o perfil nao existe. Faca nesta ordem:
1. `estado_sessao` pela ponte — e ele quem diz se esta configurado.
2. `iniciar_sessao` pela ponte — identidade, carta da matriz e protocolo.
3. Os atalhos (`./matriz`, `./{alias}`) sao junctions no computador do operador e nao abrem
   aqui: leia pelas pastas conectadas a sessao e, se a origem de um atalho nao estiver
   conectada, peca acesso a ela (pasta de origem informada pelo bloco de concessao).

Se nenhuma tool do Connect aparecer, o app desktop esta fechado ou offline: diga isso ao
operador — nao configure nada do zero aqui.
