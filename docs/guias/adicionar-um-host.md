# Adicionar um host

Roteiro para suportar um harness novo sem quebrar a paridade.

1. **Leia a documentação do host:** onde ele procura manifesto, MCP e hooks; variável de raiz;
   como executa o comando de hook em cada SO; formato da resposta do início de sessão; limite
   de tamanho do contexto injetado; se aceita "perguntar" num hook de pré-ferramenta.
2. **Crie a superfície em `plugins/connect`.** Manifesto, config de MCP apontando para
   `scripts/connect-mcp` e hook de início de sessão pelo runtime (`scripts/run-node.*`), uma linha
   por SO. Nada de `node` direto.
3. **Escreva o entrypoint** em `hooks/session-start-<host>.mjs`: leia o payload, chame
   `contextoDeInicio({ sessionId, host: '<host>' })` e embrulhe a saída no formato do host com
   `jsonAscii()`.
4. **Declare no contrato** (`tests/architecture/harness-contract.mjs`): manifesto, arquivos,
   leitor de hooks, `shell` por SO, payload e `lerSaida`. Arquivo de host sem dono no contrato
   quebra o build.
5. **Ensine o render**, se o host não tem pasta conectada: inclua o host em
   `HOSTS_FORA_DO_COWORK` (`lib/render.mjs`) com a dica de como liberar pasta, e em
   `HOSTS_COM_MEMORIA_DE_ACESSO` (`lib/bootstrap.mjs`) se ele guarda a permissão.
6. **Ajuste o marketplace** do host.
7. **Decida a paridade:** coluna nova em `tests/architecture/paridade.mjs` com `igual` ou
   `limiar` para cada capacidade. Rode `npm run gerar:paridade`.
8. **Teste:** `npm test`.
9. **Teste no host real** ([roteiro](teste-em-host-real.md)) e documente em
   [hosts e superfície](../arquitetura/hosts.md).
