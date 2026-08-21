## Design: Expansão MCP e persistência da Matriz

### Visão geral

A proposta baseia-se em três pilares:

1. Interface de provider e adaptadores (já iniciada): centralizar extração de sessão e contratos de integração em `providers/` para isolar dependências de environment entre Claude e Copilot.
2. Bridge/Local adapter para Copilot: usar um bridge HTTP local (existente em `plugins/connect/bridge/index.mjs`) como ponto de contato para o Copilot, expondo endpoints de `iniciar_sessao` e `resolver` (já presentes).
3. Extensão do MCP: adicionar métodos RPC seguros para persistência e gerenciamento de matrizes entre harnesses.

### MCP — novos métodos propostos

- `matriz.persist({ id, sourcePath, metadata, consent })` → persiste metadata de uma matriz e, opcionalmente, copia um snapshot controlado para `CONNECT_HOME`.
- `matriz.load({ id })` → retorna o estado salvo e provê instruções para montar a matriz (paths, mounts, junctions).
- `matriz.list()` → lista matrizes conhecidas/registradas.
- `matriz.remove({ id })` → remove registro (com auditoria).

Todos os métodos exigem sinal de consentimento do operador para cópia física do conteúdo; caso o operador não autorize, o MCP apenas grava referências (path) e instruções de montagem.

### Persistência da Matriz — opções e recomendação

- Opção A — `CONNECT_HOME` (recomendado): manter a matriz em uma pasta de usuário fora das pastas de extensão do Claude (`%LOCALAPPDATA%/Connect`), com links/junctions para sessões. Vantagens: não depende do diretório de extensões do Claude, sobrevive a reinstalações; Desvantagens: requer consentimento para mover/copiar dados.

- Opção B — Persistência in-repo (`.connect/matriz`): grava no repositório do projeto. Vantagens: rastreável no repo; Desvantagens: riscos de exposição, misturar dados operacionais com código-fonte.

- Opção C — Persistência em diretório compartilhado do host (configurável): similar a A, mas permite escolha centralizada por time/infra.

Recomendação: implementar suporte a A (CONNECT_HOME) como padrão e oferecer opção B como modo explícito via CLI/manual opt-in. Nunca gravar automaticamente em repositórios sem confirmação do operador.

### Auditabilidade e consentimento

- Todas as operações de persistência e montagem geram entradas de log em `{CONNECT_HOME}/audit.log` com timestamp, operador (quando disponível), operação e origem (Claude|Copilot).  
- Antes de qualquer cópia física, exibir prompt de consentimento ao operador via UI/terminal; registrar resposta.

### Compatibilidade com Claude marketplace

Não alterar arquivos já consumidos pelo Claude. Todos os recursos novos são opcionais e localizados fora do pacote do plugin (ex.: `code/copilot/` e `CONNECT_HOME`). O `plugins/connect` continua sendo o artefato empacotado para o Claude marketplace.
