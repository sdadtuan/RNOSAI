#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> KPI Hub P2 deploy"
bash "$ROOT/scripts/apply_pg_ddl_kpi_hub.sh"
bash "$ROOT/scripts/apply_pg_ddl_kpi_hub_p2.sh"
bash "$ROOT/scripts/seed_kpi_hub_rbac.sh"
bash "$ROOT/scripts/seed_kpi_hub_data.sh"

echo "==> Build API"
(cd services/ptt-crm-api && npm run build)

echo "==> Build Ops Web"
(cd services/ops-web && npm run build)

echo "OK  KPI Hub P2 deploy artifacts ready"
echo "NOTE: restart services manually if needed:"
echo "  sudo systemctl restart ptt-crm-api ptt-ops-web"
