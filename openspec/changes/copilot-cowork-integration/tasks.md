## 1. Validação e inventário

- [x] 1.1 Inventariar todas as skills e pontos de integração usados pelo Claude (lista de `SKILL.md`, templates, hooks).  
- [x] 1.2 Rodar scanner de compatibilidade para identificar dependências Claude-only (ex.: menções a `CLAUDE.md`, envs específicos, hooks).  
- [x] 1.3 Documentar pontos onde o comportamento dependente de Claude precisa de shim no Copilot.

## 2. MCP e persistência da Matriz

- [x] 2.1 Adicionar os métodos MCP propostos (`matriz.persist`, `matriz.load`, `matriz.list`, `matriz.remove`).  
- [x] 2.2 Implementar camada de consentimento e audit logging (audit.log em `CONNECT_HOME`).  
- [x] 2.3 Implementar mecanismos de montagem seguros: junction/symlink + validação de origem.

## 3. Copilot integration flow

- [x] 3.1 Consolidar e publicar os adaptadores Copilot em `code/copilot/providers` (scaffold criado).  
- [x] 3.2 Implementar chamadas de exemplo do Copilot para `iniciar_sessao` e `matriz.load` e validar que `.connect/context.md` é gerado corretamente.  
- [x] 3.3 Implementar testes E2E que simulam um harness Copilot iniciando sessão, resolvendo um conceito e escrevendo via `cnct-nucleo-escrita`.

## 4. Skills e manuais

- [x] 4.1 Criar instruções Copilot específicas (`code/copilot/skills/*/copilot.instruction.md`) — scaffold já criado.  
- [x] 4.2 Atualizar `manifest.json` das skills para apontar para instruções quando existir (opcional e não invasivo).  
- [x] 4.3 Validar que `SKILL.md` permanece inalterado e que o plugin empacotado ao Claude não muda.

## 5. Validação final e rollout

- [x] 5.1 Executar validação MCP (`5.1` do change original): rodar suite mínima de validação do MCP contra o servidor local.  
- [x] 5.2 Validar Copilot bridge E2E (3.2/3.3).  
- [x] 5.3 Reunir resultados, documentar gaps e preparar RFC/PR para atualização no repositório e instruções de instalação (CLI/manual).
