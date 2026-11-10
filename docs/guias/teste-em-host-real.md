# Teste em host real

O CI prova formato, execução dos hooks e do MCP, e paridade de conteúdo. Não prova que cada host
carrega e dispara o plugin. Este roteiro cobre o que falta. Use uma máquina **sem Node no PATH** e
um `CONNECT_HOME` novo, para exercitar o download do runtime.

## Em cada host (Codex, Copilot, Antigravity, e Cowork como controle)

| # | Passo | Esperado |
|---|---|---|
| 1 | Instalar o `connect` pelo marketplace do host | Plugin listado; no Codex, revisar e aprovar os hooks |
| 2 | Abrir uma sessão nova | Bloco "Connect — ..." no contexto; `~/Connect/bin/node` baixado na 1ª vez |
| 3 | Pedir ao agente para listar as tools do Connect | Todas as tools; nenhuma de shell |
| 4 | Dizer "primeiro uso" com um código `CNCT1-...` | Matriz configurada pelo código |
| 5 | Seguir até o perfil do operador | `~/Connect/operador/_cerebro/meu-config.md` criado |
| 6 | Pedir o briefing diário | Agendado (Cowork, VS Code, Antigravity) ou prompt entregue (Codex) |
| 7 | Abrir uma 2ª sessão | Pedido de acesso vira lembrete (fora do Cowork) |
| 8 | Pedir uma busca `grep -r` dentro da matriz | Antigravity pergunta; Codex avisa; marca em `~/Connect/logs/varredura.jsonl` |

## Pontos específicos

- **Windows:** o host acha `scripts/connect-mcp.cmd` a partir de `./scripts/connect-mcp`
  (Codex, VS Code, Antigravity).
- **Antigravity no Windows:** qual shell roda os hooks; a entrada `/bin/sh` deve falhar sem efeito.
- **Copilot CLI com sandbox de sessão:** sem `~/Connect` em `sandbox.userPolicy`, o runtime vai
  para `COPILOT_PLUGIN_DATA`, e o hook avisa do acesso.
- **macOS:** `scripts/connect-mcp` com permissão de execução depois da instalação.

Registre o resultado e, se mudar algum limiar, atualize `tests/architecture/paridade.mjs`.
