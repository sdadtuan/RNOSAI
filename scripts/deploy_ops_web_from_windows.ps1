# Build ops-web on Windows (Node 20+) and publish to VPS.
# Usage:
#   .\scripts\deploy_ops_web_from_windows.ps1              # production (port 3200)
#   .\scripts\deploy_ops_web_from_windows.ps1 -Staging     # /test only (port 3201)
param([switch]$Staging)
# Env: VPS_HOST (default rs.pttads.vn), SSH_KEY (default ~\.ssh\rnosai_root)

$ErrorActionPreference = 'Stop'
$Root = Split-Path $PSScriptRoot -Parent
$OpsWeb = Join-Path $Root 'services\ops-web'
$Tools = Join-Path $Root '.tools'
$NodeVer = 'v22.12.0'
$NodeDir = Join-Path $Tools "node-$NodeVer-win-x64"
$NodeZip = Join-Path $env:TEMP "node-$NodeVer-win-x64.zip"

$VpsHost = if ($env:VPS_HOST) { $env:VPS_HOST } else { 'rs.pttads.vn' }
$SshKey = if ($env:SSH_KEY) { $env:SSH_KEY } else { Join-Path $env:USERPROFILE '.ssh\rnosai_root' }

function Ensure-Node22 {
  if (Test-Path (Join-Path $NodeDir 'node.exe')) { return }
  New-Item -ItemType Directory -Force -Path $Tools | Out-Null
  Write-Host "== Download Node $NodeVer =="
  Invoke-WebRequest -Uri "https://nodejs.org/dist/$NodeVer/node-$NodeVer-win-x64.zip" -OutFile $NodeZip
  $extract = Join-Path $env:TEMP "node-extract-$NodeVer"
  if (Test-Path $extract) { Remove-Item -Recurse -Force $extract }
  Expand-Archive -Path $NodeZip -DestinationPath $extract
  $inner = Get-ChildItem $extract -Directory | Select-Object -First 1
  Move-Item $inner.FullName $NodeDir -Force
}

function Import-DotEnvFile {
  param([string]$Path)
  if (-not (Test-Path $Path)) { return }
  Get-Content $Path | ForEach-Object {
    $line = $_.Trim()
    if (-not $line -or $line.StartsWith('#')) { return }
    $eq = $line.IndexOf('=')
    if ($eq -lt 1) { return }
    $name = $line.Substring(0, $eq).Trim()
    $value = $line.Substring($eq + 1).Trim()
    Set-Item -Path "env:$name" -Value $value
  }
}

function Sync-StandaloneStatic {
  $standaloneNext = Join-Path $OpsWeb '.next\standalone\.next'
  New-Item -ItemType Directory -Force -Path $standaloneNext | Out-Null
  Copy-Item -Recurse -Force (Join-Path $OpsWeb '.next\static') (Join-Path $standaloneNext 'static')
  if (Test-Path (Join-Path $OpsWeb 'public')) {
    Copy-Item -Recurse -Force (Join-Path $OpsWeb 'public') (Join-Path $OpsWeb '.next\standalone\public')
  }
}

Ensure-Node22
$env:PATH = "$NodeDir;$NodeDir\node_modules\npm\bin;" + $env:PATH
& (Join-Path $NodeDir 'node.exe') -v

$env:NEXT_PUBLIC_PTT_API_URL = 'https://rs.pttads.vn'
if ($Staging) {
  $env:NEXT_PUBLIC_BASE_PATH = '/test'
}
Import-DotEnvFile (Join-Path $Root 'deploy\ops-web-client-flags.env')

Push-Location $OpsWeb
try {
  Write-Host '== npm ci (ops-web) =='
  npm ci
  Write-Host '== next build =='
  npm run build
  Sync-StandaloneStatic
} finally {
  Pop-Location
}

$releaseId = if ($Staging) { "staging-win-$(Get-Date -Format 'yyyyMMddHHmmss')" } else { "win-$(Get-Date -Format 'yyyyMMddHHmmss')" }
$stage = Join-Path $env:TEMP "ops-web-release-$releaseId"
$standalone = Join-Path $OpsWeb '.next\standalone'
if (-not (Test-Path (Join-Path $standalone 'server.js'))) {
  throw 'Missing .next/standalone/server.js — build failed?'
}
if (Test-Path $stage) { Remove-Item -Recurse -Force $stage }
New-Item -ItemType Directory -Force -Path $stage | Out-Null
Copy-Item -Recurse -Force "$standalone\*" $stage

$remoteRelease = "/var/www/rnosai/releases/ops-web-$releaseId"
Write-Host "== scp release -> $VpsHost`:$remoteRelease =="
& scp -i $SshKey -o StrictHostKeyChecking=no -r $stage "root@${VpsHost}:${remoteRelease}"

if ($Staging) {
  $remoteCmd = @"
test -f '$remoteRelease/server.js' || exit 1
chown -R deploy:deploy '$remoteRelease'
mkdir -p /var/www/rnosai/current
ln -sfn '$remoteRelease' /var/www/rnosai/current/ops-web-staging
cp /var/www/rnosai/deploy/ptt-ops-web-staging.service /etc/systemd/system/ptt-ops-web-staging.service 2>/dev/null || true
systemctl daemon-reload
systemctl enable ptt-ops-web-staging
systemctl restart ptt-ops-web-staging
sleep 2
systemctl is-active ptt-ops-web-staging
readlink /var/www/rnosai/current/ops-web-staging
"@
  Write-Host '== activate staging (/test) =='
  & ssh -i $SshKey -o StrictHostKeyChecking=no "root@$VpsHost" $remoteCmd
  Write-Host "OK  Staging: https://rs.pttads.vn/test/crm/leads — prod untouched."
} else {
  $remoteCmd = @"
test -f '$remoteRelease/server.js' || exit 1
chown -R deploy:deploy '$remoteRelease'
mkdir -p /var/www/rnosai/current
ln -sfn '$remoteRelease' /var/www/rnosai/current/ops-web
systemctl restart ptt-ops-web
sleep 2
systemctl is-active ptt-ops-web
readlink /var/www/rnosai/current/ops-web
"@
  Write-Host '== activate + restart ptt-ops-web (prod) =='
  & ssh -i $SshKey -o StrictHostKeyChecking=no "root@$VpsHost" $remoteCmd
  Write-Host "OK  Prod deployed ops-web-$releaseId — hard-refresh CRM."
}
