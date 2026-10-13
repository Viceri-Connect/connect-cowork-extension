:; exec /bin/sh "$(dirname "$0")/../scripts/run-node.sh" "$(dirname "$0")/connect-mcp.mjs" #
@echo off
:: launcher.bat — entrypoint do servidor MCP.
:: POLIGLOTA (P175, 0.37.0): a linha 1 e do `sh` (macOS/Linux) e ignora os argumentos
:: que o .mcp.json repassa; para o cmd.exe ela e um rotulo e nao executa nada.
:: A resolucao do runtime nao mora aqui: delega para scripts/run-node.bat, que e a
:: fonte unica usada tambem pelo hook de SessionStart (ver comentario la).

setlocal
set "PLUGIN_DIR=%~dp0.."
call "%PLUGIN_DIR%\scripts\run-node.bat" "%PLUGIN_DIR%\mcp\connect-mcp.mjs" %*
