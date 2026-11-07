# Chạy CRM UI local — KHÔNG deploy VPS.
# Máy này: http://127.0.0.1:3200/login
# Cùng WiFi/LAN: http://<IP-máy-này>:3200/login (listen 0.0.0.0)
# API phải là local: services\ops-web\.env.local → NEXT_PUBLIC_PTT_API_URL=http://127.0.0.1:3000

$ErrorActionPreference = 'Stop'
$Root = Split-Path $PSScriptRoot -Parent
$OpsWeb = Join-Path $Root 'services\ops-web'
$NodeDir = Join-Path $Root '.tools\node-v22.12.0-win-x64'

if (-not (Test-Path (Join-Path $NodeDir 'node.exe'))) {
  Write-Error "Thiếu Node 22 tại $NodeDir — chạy deploy_ops_web_from_windows.ps1 một lần để tải, hoặc cài Node 22."
}

Get-NetTCPConnection -LocalPort 3200 -State Listen -ErrorAction SilentlyContinue |
  ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }

$env:PATH = "$NodeDir;" + $env:PATH
# Shell kế thừa URL production sau lần deploy. Local luôn gọi API máy này.
$env:NEXT_PUBLIC_PTT_API_URL = 'http://127.0.0.1:3000'
$env:PTT_LOCAL_API_PROXY_TARGET = 'http://127.0.0.1:3000'
$lanIp = (
  Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
    Where-Object { $_.IPAddress -notlike '127.*' -and $_.PrefixOrigin -ne 'WellKnown' } |
    Select-Object -First 1 -ExpandProperty IPAddress
)
if ($lanIp) {
  Write-Host "LAN: http://${lanIp}:3200/login" -ForegroundColor Cyan
}

Push-Location $OpsWeb
try {
  & (Join-Path $NodeDir 'node.exe') '.\node_modules\next\dist\bin\next' dev -p 3200 -H 0.0.0.0
} finally {
  Pop-Location
}
