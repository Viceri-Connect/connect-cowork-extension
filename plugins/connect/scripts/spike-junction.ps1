# spike-junction.ps1 — prova a PREMISSA 2 no host Windows:
#   uma junction NTFS criada FORA do OneDrive, apontando para a matriz (que ESTÁ
#   no OneDrive), é lida transparentemente por caminho relativo?
#
# Não exige privilégio de administrador (junction, não symlink).
# Uso:
#   powershell -ExecutionPolicy Bypass -File .\spike-junction.ps1 `
#       -Matriz "C:\Users\voce\Sua Empresa\sua-matriz" `
#       -Home   "$env:LOCALAPPDATA\Connect"

param(
  [Parameter(Mandatory=$true)][string]$Matriz,
  [string]$Home = "$env:LOCALAPPDATA\Connect"
)

$ErrorActionPreference = "Stop"
$sid = "spike-" + (Get-Date -Format "yyyyMMdd-HHmmss")
$ws  = Join-Path $Home ("sessions\" + $sid)
New-Item -ItemType Directory -Force -Path $ws | Out-Null

$alias = Join-Path $ws "matriz"
Write-Host "Home (fora do OneDrive): $Home"
Write-Host "Scaffold da sessão:      $ws"
Write-Host "Criando junction:        $alias  ->  $Matriz"

# cmd mklink /J = junction de diretório (sem admin)
cmd /c mklink /J "`"$alias`"" "`"$Matriz`"" | Out-Null

# Lê um arquivo da matriz ATRAVÉS do atalho, por caminho relativo ao scaffold
$rel = "matriz\_cerebro\vault-config.md"
$full = Join-Path $ws $rel
Write-Host ""
Write-Host "Lendo ATRAVÉS da junction: .\$rel"
if (Test-Path $full) {
  $head = (Get-Content -Path $full -TotalCount 8) -join "`n"
  Write-Host "OK — leitura pela junction funcionou. Primeiras linhas:"
  Write-Host "----"
  Write-Host $head
  Write-Host "----"
} else {
  Write-Warning "NÃO encontrou $full — verifique o caminho da matriz."
}

# Confirma que a origem ficou intacta e remove só o atalho
Write-Host ""
Write-Host "Removendo apenas o atalho (rmdir na junction; origem intacta)..."
cmd /c rmdir "`"$alias`"" | Out-Null
if (Test-Path (Join-Path $Matriz "_cerebro\vault-config.md")) {
  Write-Host "OK — origem intacta após remover o atalho."
} else {
  Write-Warning "ATENÇÃO — origem não encontrada após remover o atalho (investigar)."
}
Write-Host ""
Write-Host "Spike concluído. Se as duas linhas 'OK' apareceram, a premissa 2 se sustenta neste host."
