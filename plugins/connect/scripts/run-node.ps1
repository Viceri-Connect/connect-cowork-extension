# run-node.ps1 - entrada do hook de SessionStart no Windows (0.39.0).
#
# POR QUE EXISTE: ate a 0.38.x o hook era SHELL FORM ("run-node.bat" "session-start.mjs").
# No Windows, shell form roda em Git Bash; sem Git Bash, roda em PowerShell, que AVALIA
# a linha como duas strings e imprime em vez de executar - o hook "passa" sem fazer
# nada e a camada 0 some. Instalar o Git pede administrador (medido no instalador de 27/10).
#
# O hook passa a ser EXEC FORM (`command` + `args`, sem shell): `powershell.exe -File`
# este script. PowerShell existe em todo Windows suportado, nao pede elevacao, e o
# `-File` recebe cada argumento inteiro (caminho com espaco nao quebra).
#
# Este script NAO resolve runtime: delega ao run-node.bat, que continua a FONTE UNICA
# (Node portatil em %CONNECT_HOME%\bin). Ele so faz a ponte, e de um jeito especifico:
#   - o filho roda por Start-Process -NoNewWindow SEM redirecionar a saida: o cmd e o
#     node herdam o stdout deste processo e escrevem nele DIRETO. Se a saida passasse
#     pelo pipeline do PowerShell 5.1, ela seria redecodificada pela pagina OEM e os
#     acentos do bloco de contexto chegariam corrompidos;
#   - o stdin do hook (JSON com session_id) vai para um arquivo temporario e entra no
#     filho por -RedirectStandardInput - mesmo motivo, bytes intactos;
#   - `cmd /d /s /c ""bat" "script""`: com /s o cmd tira SO o par de aspas externo, e
#     os dois caminhos chegam entre aspas, com ou sem espaco.
#
# Uso: powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File run-node.ps1 <script.mjs> [args...]
# Mantido em ASCII puro: o PowerShell 5.1 le .ps1 sem BOM como ANSI.

$ErrorActionPreference = 'Stop'

$bat = Join-Path $PSScriptRoot 'run-node.bat'
$partes = @('"' + $bat + '"')
foreach ($a in $args) { $partes += '"' + ([string]$a).Replace('"', '') + '"' }
$linha = '/d /s /c "' + ($partes -join ' ') + '"'

$entrada = $null
try {
    if ([Console]::IsInputRedirected) {
        $stdin = New-Object System.IO.StreamReader([Console]::OpenStandardInput(), (New-Object System.Text.UTF8Encoding($false)))
        $texto = $stdin.ReadToEnd()
        if ($texto) {
            $entrada = [System.IO.Path]::GetTempFileName()
            [System.IO.File]::WriteAllText($entrada, $texto, (New-Object System.Text.UTF8Encoding($false)))
        }
    }
} catch {
    # Sem payload legivel o session-start segue com o id do ambiente ou gerado.
    $entrada = $null
}

$comspec = $env:ComSpec
if (-not $comspec) { $comspec = Join-Path $env:SystemRoot 'System32\cmd.exe' }

$codigo = 1
try {
    $opcoes = @{ FilePath = $comspec; ArgumentList = $linha; NoNewWindow = $true; Wait = $true; PassThru = $true }
    if ($entrada) { $opcoes.RedirectStandardInput = $entrada }
    $p = Start-Process @opcoes
    if ($null -ne $p.ExitCode) { $codigo = $p.ExitCode } else { $codigo = 0 }
} catch {
    [Console]::Error.WriteLine("[connect] falha ao executar o run-node.bat: $($_.Exception.Message)")
} finally {
    if ($entrada) { Remove-Item -LiteralPath $entrada -Force -ErrorAction SilentlyContinue }
}
exit $codigo
