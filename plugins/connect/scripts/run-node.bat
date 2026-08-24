@echo off
:: run-node.bat - garante o Node portatil e executa o script recebido.
::
:: Fonte UNICA da resolucao do runtime, usada pelo launcher do MCP e pelo hook de
:: SessionStart. Ate a 0.12.2 so o MCP tinha node embarcado; o hook chamava `node` do
:: PATH e falhava em silencio em maquina sem Node - meia-garantia e o mesmo defeito
:: que o D104 nomeou (D153).
::
:: MUDANCA 0.15.0 - o runtime SAI do diretorio do pacote.
::   Medido em 24/08: a atualizacao do plugin apagou o conteudo do pacote, esbarrou em
::   bin\node.exe (o unico arquivo EM USO pelo servidor MCP rodando), abortou, e deixou
::   a instalacao destruida - plugin.json reduzido a 23 bytes, nenhum lib/. Windows nao
::   substitui .exe com processo ativo. Ou seja: embutir o runtime no pacote tornou o
::   plugin NAO-ATUALIZAVEL enquanto ele roda, que e exatamente quando se atualiza.
::
::   O runtime passa a viver em %CONNECT_HOME%\bin - onde ele sempre pertenceu:
::   CONCEITOS.md secao 5 declara o CONNECT_HOME como a pasta de estado/runtime da
::   maquina. Efeitos: atualizacao nunca mais toca em arquivo em uso; o download de
::   ~70 MB deixa de se repetir a cada versao; a garantia do D153 continua de pe.
::
:: Uso: run-node.bat <caminho-do-script.mjs> [args...]

setlocal

set "PLUGIN_DIR=%~dp0.."

:: Mesma resolucao de lib/config-local.mjs (defaultConnectHome): env var, ou o perfil
:: do usuario. NUNCA pasta de aplicativo (%LOCALAPPDATA%) - ver D149.
if not defined CONNECT_HOME set "CONNECT_HOME=%USERPROFILE%\Connect"
set "BIN_DIR=%CONNECT_HOME%\bin"
set "NODE_EXE=%BIN_DIR%\node.exe"
set "NODE_LEGADO=%PLUGIN_DIR%\bin\node.exe"
set "NODE_URL=https://nodejs.org/dist/v20.11.1/win-x64/node.exe"

if exist "%NODE_EXE%" goto :executar

if not exist "%BIN_DIR%" mkdir "%BIN_DIR%" 2>nul

:: 1) Migracao silenciosa: se o pacote ainda traz o runtime da versao anterior,
::    aproveita. Evita rebaixar 70 MB de quem ja tinha o plugin instalado.
if exist "%NODE_LEGADO%" (
    copy /y "%NODE_LEGADO%" "%NODE_EXE%" >nul 2>&1
    if exist "%NODE_EXE%" goto :verificar
)

:: 2) Download ATOMICO e verificado.
::    -f faz o curl falhar em erro HTTP: sem ele, uma pagina de erro 404 seria gravada
::    como node.exe com exit 0, e o `if exist` das proximas execucoes nunca mais
::    tentaria baixar - binario corrompido permanente (mesma classe do .git\index.lock
::    orfao da P77: artefato parcial que bloqueia o caminho).
curl -fsSL "%NODE_URL%" -o "%NODE_EXE%.tmp"
if errorlevel 1 goto :sem_runtime
move /y "%NODE_EXE%.tmp" "%NODE_EXE%" >nul 2>&1
if not exist "%NODE_EXE%" goto :sem_runtime

:verificar
:: Baixado nao e o mesmo que funciona: binario truncado so se revela na execucao.
"%NODE_EXE%" -v >nul 2>&1
if errorlevel 1 (
    del /q "%NODE_EXE%" 2>nul
    goto :sem_runtime
)

:executar
"%NODE_EXE%" %*
exit /b %errorlevel%

:sem_runtime
:: Ultimo recurso, declarado: o Node do PATH. Nao e garantia (D153) - por isso avisa
:: em stderr em vez de degradar em silencio, que e o modo de falha que o D153 fechou.
del /q "%NODE_EXE%.tmp" 2>nul
where node >nul 2>&1
if errorlevel 1 (
    echo [connect] ERRO: runtime indisponivel. Falha ao obter o Node portatil de %NODE_URL% >&2
    echo [connect] e nao ha node no PATH. Verifique conectividade/proxy corporativo. >&2
    exit /b 1
)
echo [connect] AVISO: usando o node do PATH - runtime portatil indisponivel. >&2
node %*
exit /b %errorlevel%
