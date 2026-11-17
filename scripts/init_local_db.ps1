# Khởi tạo PostgreSQL LOCAL (rnosaidb) — không VPS.
# Cần một trong hai:
#   A) Docker Desktop: docker compose up -d postgres  (port 5433)
#   B) PostgreSQL cài trên Windows: tạo user ptt / pass ptt_dev / DB rnosaidb / listen 5433
#
# Usage: .\scripts\init_local_db.ps1

$ErrorActionPreference = 'Stop'
$Root = Split-Path $PSScriptRoot -Parent
$DbUrl = 'postgresql://ptt:ptt_dev@127.0.0.1:5433/rnosaidb'

function Test-Docker {
  try { docker info 2>$null | Out-Null; return $true } catch { return $false }
}

if (Test-Docker) {
  Write-Host '== docker compose up postgres (5433) =='
  Push-Location $Root
  try { docker compose up -d postgres } finally { Pop-Location }
  Write-Host 'Waiting for postgres...'
  Start-Sleep -Seconds 8
} else {
  Write-Host 'Docker không có — dùng PostgreSQL cài sẵn trên máy (port 5433).'
  Write-Host 'Tạo DB: rnosaidb, user: ptt, password: ptt_dev'
}

$ddl1 = Join-Path $Root 'docs\specs\2026-07-17-postgresql-ddl-v1.sql'
$ddl2 = Join-Path $Root 'docs\specs\2026-07-17-postgresql-ddl-v2-leads.sql'
$ddlStaff = Join-Path $Root 'docs\specs\2026-07-20-postgresql-ddl-staff-auth.sql'

$psql = Get-Command psql -ErrorAction SilentlyContinue
if (-not $psql) {
  Write-Host ''
  Write-Host 'Chưa có psql trong PATH. Sau khi có Postgres:'
  Write-Host "  psql `"$DbUrl`" -f `"$ddl1`""
  Write-Host "  psql `"$DbUrl`" -f `"$ddl2`""
  Write-Host "  psql `"$DbUrl`" -f `"$ddlStaff`""
  Write-Host 'Hoặc cài Docker Desktop rồi chạy lại script này.'
  exit 0
}

foreach ($f in @($ddl1, $ddl2, $ddlStaff)) {
  if (-not (Test-Path $f)) { Write-Warning "Missing $f"; continue }
  Write-Host "== apply $(Split-Path $f -Leaf) =="
  & psql $DbUrl -v ON_ERROR_STOP=1 -f $f
}

Write-Host 'OK  Local DB base DDL applied.'
