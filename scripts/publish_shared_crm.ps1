# Publish CRM UI lên link CHUNG cho team (staging /test — KHÔNG đụng prod /crm).
#
# Link cố định gửi đồng nghiệp:
#   https://rs.pttads.vn/test/crm/leads
#   https://rs.pttads.vn/test/admin
#
# Quy trình:
#   1. Sửa code trên máy → test http://127.0.0.1:3200
#   2. Ổn → chạy script này (~20 phút build + upload)
#   3. Team mở link /test ở trên (Ctrl+Shift+R)
#
# Lưu ý: /test vẫn gọi API + DB prod — thao tác ghi (Lost, assign, lưu lead) là dữ liệu thật.

$ErrorActionPreference = 'Stop'
& (Join-Path $PSScriptRoot 'deploy_ops_web_from_windows.ps1') -Staging

Write-Host ''
Write-Host '========== LINK CHUNG (copy gửi team) ==========' -ForegroundColor Cyan
Write-Host '  CRM:    https://rs.pttads.vn/test/crm/leads'
Write-Host '  Login:  https://rs.pttads.vn/test/login'
Write-Host '  Admin:  https://rs.pttads.vn/test/admin'
Write-Host 'Prod /crm KHÔNG đổi: https://rs.pttads.vn/crm/leads'
Write-Host '================================================'
