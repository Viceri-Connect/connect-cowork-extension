## Proposta: Integração Copilot ↔ Connect (validação de fluxo e persistência da Matriz)

### Objetivo

Validar o fluxo funcional existente do Connect (atualmente orientado ao Claude Cowork) e adaptar/estender o MCP e as integrações para que o GitHub Copilot possa usar o mesmo protocolo mínimo de sessão, resolução e escrita, sem impactar a entrega do plugin ao Claude marketplace.

### Problema

O Connect hoje funciona como plugin/marketplace para o Claude Cowork. Grande parte das instruções e artefatos (ex.: `SKILL.md`, `CLAUDE.md`) são lidas pelo runtime do Claude, e a instalação do plugin reside na pasta de extensões do Claude, o que dificulta que ferramentas externas (Copilot) compartilhem o mesmo estado (ex.: `matriz`) entre execuções/harnesses.

### Escopo

- Validar o fluxo das funções/skills existentes para garantir comportamento idêntico quando acionadas por Copilot.
- Estender o MCP com RPCs mínimos para persistência e recuperação da `matriz` entre sessões/harnesses.
- Fornecer um caminho não-invasivo (opt-in) para que o Copilot crie/consuma artefatos de integração local em `code/copilot/` sem alterar os `SKILL.md` que o Claude usa.
- Preservar compatibilidade total com entrega atual ao Claude marketplace (nenhuma mudança obrigatória nos arquivos que o Claude espera).

### Critérios de sucesso

- Todas as skills listadas mantêm comportamento funcional ao serem acionadas via Copilot (paridade comportamental nas operações críticas: `iniciar_sessao`, `resolver`, `montar`, `escrever`).
- O MCP oferece endpoints para persistir/recuperar a `matriz` entre harnesses, com consentimento do operador e logging de auditoria.
- A solução não altera a forma de empacotamento do plugin para o Claude marketplace por padrão.
