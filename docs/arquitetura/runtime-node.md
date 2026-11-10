# Runtime portátil

Nenhum host depende de `node` no PATH. Hooks e MCP passam por `plugins/connect/scripts/`.

| Arquivo | Papel |
|---|---|
| `run-node.bat` | Fonte única no Windows: acha ou baixa o Node portátil e executa o script. |
| `run-node.sh` | Espelho POSIX (macOS/Linux). |
| `run-node.ps1` | Ponte do PowerShell para o `.bat`, sem pipeline (stdin e acentos intactos). |
| `connect-mcp` / `connect-mcp.cmd` | Entrada do MCP nos hosts do formato portável. O POSIX precisa de modo 755 no git. |
| `../mcp/launcher.bat` | Entrada do MCP no Cowork (arquivo poliglota cmd/sh). |

## Onde o Node fica

1. `CONNECT_HOME/bin/node(.exe)`: baixado uma vez, reaproveitado entre sessões e versões do plugin.
2. **Sandbox sem escrita no CONNECT_HOME**: a pasta de dados que o host dá ao plugin
   (`PLUGIN_DATA`, `COPILOT_PLUGIN_DATA` ou `CLAUDE_PLUGIN_DATA`) + `/bin`.
3. Último recurso, com aviso no stderr: o `node` do PATH.

Na nuvem do Claude (`CLAUDE_CODE_REMOTE=true`) o `run-node.sh` usa o Node do servidor direto.

## Por que o runtime fica fora do pacote

O Windows não substitui `.exe` em uso. Com o Node dentro do pacote, atualizar o plugin com o MCP
rodando quebrava a instalação. Em `CONNECT_HOME/bin` a atualização nunca toca arquivo em uso.

## Primeira sessão

O download (~70 MB) acontece na 1ª sessão. Por isso o SessionStart de Codex, Copilot e
Antigravity tem timeout de 120 s.

## Provas

- `tests/integration/runtime-sandbox.test.mjs` — o fallback para a pasta de dados do host.
- Features "runtime portátil" e "hook pelo runtime" do contrato — nenhum host chama `node` direto,
  e o hook roda pela linha real do host.
- Launcher do MCP — responde ao handshake pelo runtime e tem modo 755.
