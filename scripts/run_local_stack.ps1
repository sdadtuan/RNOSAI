# Stack local: API + UI — không VPS, không proxy prod.
#
# Lần đầu:
#   1. .\scripts\init_local_db.ps1
#   2. copy deploy\env.local-dev.example → services\ptt-crm-api\.env
#
# Mỗi lần dev (2 terminal):
#   Terminal A: .\scripts\run_local_crm_api.ps1
#   Terminal B: .\scripts\run_ops_web_local.ps1
#
# UI: http://127.0.0.1:3200/login  |  LAN: http://<IP>:3200/login
# Login stub: staff@demo.local / demo123

Write-Host @"

=== LOCAL ONLY (no VPS) ===
Terminal 1: .\scripts\run_local_crm_api.ps1
Terminal 2: .\scripts\run_ops_web_local.ps1

"@ -ForegroundColor Cyan
