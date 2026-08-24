@echo off
:: launcher.bat — entrypoint do servidor MCP.
:: A resolucao do runtime nao mora aqui: delega para scripts/run-node.bat, que e a
:: fonte unica usada tambem pelo hook de SessionStart (ver comentario la).

setlocal
set "PLUGIN_DIR=%~dp0.."
call "%PLUGIN_DIR%\scripts\run-node.bat" "%PLUGIN_DIR%\mcp\connect-mcp.mjs" %*
