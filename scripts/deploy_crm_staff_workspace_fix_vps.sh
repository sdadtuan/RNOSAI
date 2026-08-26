#!/usr/bin/env bash
# Fix staff workspace 500 (missing deal_value_vnd) + HR hub expiry (boolean active).
#
# From laptop:
#   APPLY=1 ./scripts/deploy_crm_staff_workspace_fix_vps.sh
#
# On VPS directly:
#   cd /var/www/rnosai && bash scripts/deploy_crm_staff_workspace_fix_vps.sh --local
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VPS_HOST="${PTT_VPS_HOST:-rs.pttads.vn}"
VPS_USER="${PTT_VPS_USER:-deploy}"
VPS_ROOT="${PTT_VPS_ROOT:-/var/www/rnosai}"
APPLY="${APPLY:-0}"

sync_to_vps() {
  echo "== Rsync fix files to ${VPS_USER}@${VPS_HOST} =="
  rsync -av \
    "$ROOT/docs/specs/postgresql-ddl-crm-cases-deal-value.sql" \
    "${VPS_USER}@${VPS_HOST}:${VPS_ROOT}/docs/specs/postgresql-ddl-crm-cases-deal-value.sql"
  rsync -av \
    "$ROOT/scripts/apply_pg_ddl_crm_cases_deal_value.sh" \
    "${VPS_USER}@${VPS_HOST}:${VPS_ROOT}/scripts/apply_pg_ddl_crm_cases_deal_value.sh"
  rsync -av \
    "$ROOT/scripts/deploy_crm_staff_workspace_fix_vps.sh" \
    "${VPS_USER}@${VPS_HOST}:${VPS_ROOT}/scripts/deploy_crm_staff_workspace_fix_vps.sh"
  rsync -av \
    "$ROOT/services/ptt-crm-api/src/hr-employee-file/hr-staff-p5.repository.ts" \
    "${VPS_USER}@${VPS_HOST}:${VPS_ROOT}/services/ptt-crm-api/src/hr-employee-file/hr-staff-p5.repository.ts"
  rsync -av \
    "$ROOT/services/ptt-crm-api/src/hr-employee-file/hr-doc-wallet.repository.ts" \
    "${VPS_USER}@${VPS_HOST}:${VPS_ROOT}/services/ptt-crm-api/src/hr-employee-file/hr-doc-wallet.repository.ts"
}

run_local() {
  cd "$ROOT"
  echo "== CRM staff workspace fix @ $(git rev-parse --short HEAD 2>/dev/null || echo local) =="

  if [[ -f "$ROOT/.env" ]]; then
    set -a
    # shellcheck disable=SC1091
    source "$ROOT/.env"
    set +a
  fi

  echo "== Apply crm_cases deal_value_vnd DDL =="
  bash "$ROOT/scripts/apply_pg_ddl_crm_cases_deal_value.sh"

  echo "== Build ptt-crm-api =="
  cd "$ROOT/services/ptt-crm-api"
  npm ci --silent 2>/dev/null || npm ci
  npm run build
  sudo -n /usr/bin/systemctl restart ptt-crm-api 2>/dev/null || sudo /usr/bin/systemctl restart ptt-crm-api
  sleep 2
  curl -sf http://127.0.0.1:3000/health && echo " Nest OK"

  echo "== Verify staff workspace endpoint =="
  curl -sf "http://127.0.0.1:3000/api/crm/staff/4/workspace" -H "Authorization: Bearer ${STAFF_JWT:-}" | head -c 200 || true
  echo

  echo "== CRM staff workspace fix complete =="
}

if [[ "${1:-}" == "--local" ]]; then
  run_local
elif [[ "$APPLY" == "1" ]]; then
  sync_to_vps
  ssh "${VPS_USER}@${VPS_HOST}" "chmod +x ${VPS_ROOT}/scripts/apply_pg_ddl_crm_cases_deal_value.sh ${VPS_ROOT}/scripts/deploy_crm_staff_workspace_fix_vps.sh && bash ${VPS_ROOT}/scripts/deploy_crm_staff_workspace_fix_vps.sh --local"
else
  echo "Dry-run. Set APPLY=1 to deploy to ${VPS_USER}@${VPS_HOST}:${VPS_ROOT}"
  echo "Or on VPS: bash scripts/deploy_crm_staff_workspace_fix_vps.sh --local"
fi
