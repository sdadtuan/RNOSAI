# Đo thời gian load/trang local (HTTP) — không VPS.
param(
  [string]$Base = 'http://127.0.0.1:3200',
  [string]$ApiBase = 'http://127.0.0.1:3000'
)

function Measure-Get {
  param([string]$Url, [int]$Runs = 3)
  $ms = @()
  foreach ($i in 1..$Runs) {
    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    try {
      $r = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 180 -MaximumRedirection 5
      $sw.Stop()
      $ms += [PSCustomObject]@{ ms = $sw.ElapsedMilliseconds; code = $r.StatusCode; final = $r.BaseResponse.ResponseUri.AbsoluteUri }
    } catch {
      $sw.Stop()
      $ms += [PSCustomObject]@{ ms = $sw.ElapsedMilliseconds; code = 'ERR'; final = $_.Exception.Message }
    }
  }
  $ok = $ms | Where-Object { $_.code -ne 'ERR' }
  [PSCustomObject]@{
    Url = $Url
    Min_ms = ($ok.ms | Measure-Object -Minimum).Minimum
    Max_ms = ($ok.ms | Measure-Object -Maximum).Maximum
    Avg_ms = if ($ok) { [math]::Round(($ok.ms | Measure-Object -Average).Average, 0) } else { $null }
    Last = $ms[-1]
  }
}

Write-Host "=== Local benchmark $(Get-Date -Format 'yyyy-MM-dd HH:mm') ===" -ForegroundColor Cyan
Write-Host "UI: $Base | API: $ApiBase"
Write-Host ""

$apiHealth = Measure-Get "$ApiBase/health" 1
Write-Host ("API /health: {0} ms ({1})" -f $apiHealth.Last.ms, $apiHealth.Last.code)

$pages = @(
  @{ Name = 'Login (HTML)'; Path = '/login' },
  @{ Name = 'Home redirect'; Path = '/' },
  @{ Name = 'CRM Leads (auth redirect)'; Path = '/crm/leads' },
  @{ Name = 'Admin hub (auth redirect)'; Path = '/admin' },
  @{ Name = 'Intake'; Path = '/crm/intake' },
  @{ Name = 'Staff roster'; Path = '/crm/staff' }
)

$rows = foreach ($p in $pages) {
  $m = Measure-Get "$Base$($p.Path)"
  [PSCustomObject]@{
    Thao_tac = $p.Name
    Path = $p.Path
    Min_ms = $m.Min_ms
    Avg_ms = $m.Avg_ms
    Max_ms = $m.Max_ms
    HTTP = $m.Last.code
  }
}

$rows | Format-Table -AutoSize

if ($apiHealth.Last.code -ne 200) {
  Write-Host ""
  Write-Host 'API local chưa chạy hoặc DB chưa có — chỉ đo được HTML/redirect.' -ForegroundColor Yellow
  Write-Host 'Để đo login + CRM đầy đủ: Postgres 5433 + .\scripts\run_local_crm_api.ps1' -ForegroundColor Yellow
}
