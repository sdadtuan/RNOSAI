# API CRM local — DB local, KHÔNG VPS.
# Trước: copy deploy\env.local-dev.example → services\ptt-crm-api\.env
#        .\scripts\init_local_db.ps1

$ErrorActionPreference = 'Stop'
$Root = Split-Path $PSScriptRoot -Parent
$ApiDir = Join-Path $Root 'services\ptt-crm-api'
$NodeDir = Join-Path $Root '.tools\node-v22.12.0-win-x64'
$EnvFile = Join-Path $ApiDir '.env'
$EnvExample = Join-Path $Root 'deploy\env.local-dev.example'

if (-not (Test-Path $EnvFile)) {
  if (-not (Test-Path $EnvExample)) { throw "Missing $EnvExample" }
  Copy-Item $EnvExample $EnvFile
  Write-Host "Created $EnvFile from example — chỉnh nếu cần."
}

if (-not (Test-Path (Join-Path $NodeDir 'node.exe'))) {
  Write-Error "Thiếu Node 22 tại $NodeDir"
}

Get-Content $EnvFile | ForEach-Object {
  $line = $_.Trim()
  if (-not $line -or $line.StartsWith('#')) { return }
  $i = $line.IndexOf('=')
  if ($i -lt 1) { return }
  Set-Item -Path "env:$($line.Substring(0, $i).Trim())" -Value $line.Substring($i + 1).Trim()
}

if ($env:DATABASE_URL -match 'pttads|rs\.pttads') {
  throw 'DATABASE_URL trỏ VPS — sửa services/ptt-crm-api/.env cho DB local.'
}

$env:PATH = "$NodeDir;" + $env:PATH
Push-Location $ApiDir
try {
  if (-not (Test-Path 'node_modules')) { npm ci }
  Write-Host "== ptt-crm-api http://127.0.0.1:$($env:PORT) (DB local) =="
  npm run start:dev
} finally {
  Pop-Location
}
