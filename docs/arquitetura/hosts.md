# Hosts e superfície

Cada host lê arquivos próprios dentro do mesmo pacote. A lista abaixo é a mesma que o
[contrato de harness](../conceitos/contrato-de-harness.md) verifica.

| Host | Manifesto | MCP | Hooks | Extra |
|---|---|---|---|---|
| Claude/Cowork | `.claude-plugin/plugin.json` | `.mcp.json` → `mcp/launcher.bat` | `hooks/hooks.json` (exec form, uma entrada por SO) | — |
| Codex | `plugin.json` › `extensions.com.openai` (espelhado em `.codex-plugin/plugin.json`) | `mcp.json` → `scripts/connect-mcp` | `hooks/codex-hooks.json` (`command` + `commandWindows`) | `onboardingSkill`, vitrine |
| Copilot | `plugin.json` (Agent Plugins) | `mcp.json` → `scripts/connect-mcp` | `com.github.copilot/hooks/hooks.json` (`bash` + `powershell`) | — |
| Antigravity | `.antigravity-plugin/plugin.json` | `mcp_config.json` → `${PLUGIN_ROOT}/scripts/connect-mcp` | `hooks.json` (grupos nomeados, uma entrada por SO, caminho `./`) | `rules/AGENTS.md` |

## Variáveis de raiz

| Host | Variável | Observação |
|---|---|---|
| Claude/Cowork | `${CLAUDE_PLUGIN_ROOT}` | — |
| Codex | `${PLUGIN_ROOT}` | substituída no texto do comando; também vira env var |
| Copilot | `${PLUGIN_ROOT}` | expandida pelo host |
| Antigravity | caminho relativo `./` | hooks rodam com o diretório atual na raiz do plugin |

Usar a variável de outro host quebra em silêncio; o contrato barra (feature "isolamento").

## Como cada host executa o hook

| Host | macOS/Linux | Windows |
|---|---|---|
| Claude/Cowork | exec form `/bin/sh run-node.sh` | exec form `powershell -File run-node.ps1` |
| Codex | `$SHELL -lc "<command>"` | `cmd /C "<commandWindows>"` → `run-node.bat` |
| Copilot | campo `bash` | campo `powershell` |
| Antigravity | entrada `/bin/sh ...` | entrada `powershell.exe ...` (a outra falha ao iniciar e é ignorada) |

## Saída que cada host espera do SessionStart

| Host | Formato |
|---|---|
| Claude/Cowork | texto puro no stdout |
| Codex | `{"hookSpecificOutput": {"hookEventName": "SessionStart", "additionalContext": "..."}}` |
| Copilot | `{"additionalContext": "..."}` |
| Antigravity | `{"injectSteps": [{"systemMessage": {"systemMessage": "..."}}]}` |

As respostas JSON saem em ASCII (`lib/saida-hook.mjs`) para atravessar o PowerShell do Windows
sem perder acento.

## Marketplaces

| Arquivo | Quem lê |
|---|---|
| `.claude-plugin/marketplace.json` | Cowork/Claude Code e VS Code (marketplace `impulsa`) |
| `.agents/plugins/marketplace.json` | Codex e Antigravity |
| `.github/copilot/settings.json` | VS Code/Copilot: registra `impulsa` e habilita `connect` |
