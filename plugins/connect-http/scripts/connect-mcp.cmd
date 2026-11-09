@echo off
:: connect-mcp.cmd - entrada do servidor MCP para os hosts do formato portavel no
:: Windows (Codex e Copilot via mcp.json; Antigravity via mcp_config.json). O host
:: recebe `scripts/connect-mcp` e resolve esta extensao pelo PATHEXT, como faz com `npx`.
:: macOS/Linux usam o irmao sem extensao (scripts/connect-mcp).
::
:: 0.41.0 - o runtime e o MESMO do Cowork: run-node.bat garante o Node portatil
:: (%CONNECT_HOME%\bin, ou a pasta de dados do host em sandbox) e cai no node do PATH
:: so como ultimo recurso declarado. Nada aqui escreve no stdout: ele e do protocolo.
call "%~dp0run-node.bat" "%~dp0..\mcp\connect-mcp.mjs" %*
exit /b %errorlevel%
