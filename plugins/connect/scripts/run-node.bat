@echo off
:: run-node.bat — garante o Node portatil do plugin e executa o script recebido.
::
:: Fonte UNICA da resolucao do runtime. Ate a 0.12.2 so o servidor MCP passava pelo
:: launcher com node embarcado; o hook de SessionStart chamava `node` do PATH — logo,
:: em maquina sem Node instalado o hook falhava em silencio e o produto degradava para
:: o fallback por skill, enquanto o README ja anunciava "nao exige Node instalado".
:: Meia-garantia e o mesmo defeito que o D104 nomeou: se depende de o ambiente ter algo,
:: nao e garantia.
::
:: Uso: run-node.bat <caminho-do-script.mjs> [args...]

setlocal
set "PLUGIN_DIR=%~dp0.."
set "BIN_DIR=%PLUGIN_DIR%\bin"
set "NODE_EXE=%BIN_DIR%\node.exe"
set "NODE_URL=https://nodejs.org/dist/v20.11.1/win-x64/node.exe"

if not exist "%NODE_EXE%" (
    if not exist "%BIN_DIR%" mkdir "%BIN_DIR%"
    curl -sL "%NODE_URL%" -o "%NODE_EXE%"
    if errorlevel 1 (
        echo [connect] ERRO: falha ao baixar o Node.js portatil de %NODE_URL% >&2
        echo [connect] Verifique conectividade/proxy corporativo. >&2
        exit /b 1
    )
)

"%NODE_EXE%" %*
