@echo off
setlocal

:: Define caminhos
set "PLUGIN_DIR=%~dp0.."
set "BIN_DIR=%PLUGIN_DIR%\bin"
set "NODE_EXE=%BIN_DIR%\node.exe"
set "MCP_SCRIPT=%PLUGIN_DIR%\mcp\connect-mcp.mjs"
set "NODE_URL=https://nodejs.org/dist/v20.11.1/win-x64/node.exe"

:: Verifica se o node.exe ja existe
if not exist "%NODE_EXE%" (
    :: Cria a pasta bin se nao existir
    if not exist "%BIN_DIR%" mkdir "%BIN_DIR%"
    
    :: Baixa o node.exe silenciosamente usando o curl nativo do Windows 10+
    curl -sL "%NODE_URL%" -o "%NODE_EXE%"
    
    :: Verifica se o download falhou
    if errorlevel 1 (
        echo [connect-mcp] ERRO: Falha ao baixar o Node.js. >&2
        exit /b 1
    )
)

:: Executa o servidor MCP passando todos os argumentos recebidos
"%NODE_EXE%" "%MCP_SCRIPT%" %*
