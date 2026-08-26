#!/usr/bin/env bash
# Deploy crm_hr_pii catalog + seed SUPER-ADMIN caps on VPS.
#
# From laptop:
#   APPLY=1 ./scripts/deploy_hr_pii_rbac_vps.sh
#
# On VPS directly:
#   cd /var/www/rnosai && bash scripts/deploy_hr_pii_rbac_vps.sh --local
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VPS_HOST="${PTT_VPS_HOST:-rs.pttads.vn}"
VPS_USER="${PTT_VPS_USER:-deploy}"
VPS_ROOT="${PTT_VPS_ROOT:-/var/www/rnosai}"
APPLY="${APPLY:-0}"

sync_to_vps() {
  echo "== Rsync HR PII RBAC files to ${VPS_USER}@${VPS_HOST} =="
  rsync -av \
    "$ROOT/services/ptt-crm-api/src/staff-permissions/rbac-admin-catalog.json" \
    "${VPS_USER}@${VPS_HOST}:${VPS_ROOT}/services/ptt-crm-api/src/staff-permissions/rbac-admin-catalog.json"
  rsync -av \
    "$ROOT/scripts/seed_hr_pii_rbac.sh" \
    "${VPS_USER}@${VPS_HOST}:${VPS_ROOT}/scripts/seed_hr_pii_rbac.sh"
  rsync -av \
    "$ROOT/scripts/deploy_hr_pii_rbac_vps.sh" \
    "${VPS_USER}@${VPS_HOST}:${VPS_ROOT}/scripts/deploy_hr_pii_rbac_vps.sh"
}

run_local() {
  cd "$ROOT"
  echo "== HR PII RBAC deploy @ $(git rev-parse --short HEAD 2>/dev/null || echo local) =="

  if [[ -f "$ROOT/.env" ]]; then
    set -a
    # shellcheck disable=SC1091
    source "$ROOT/.env"
    set +a
  fi

  echo "== Seed crm_hr_pii for SUPER-ADMIN =="
  bash "$ROOT/scripts/seed_hr_pii_rbac.sh" --apply

  echo "== Build ptt-crm-api =="
  cd "$ROOT/services/ptt-crm-api"
  npm ci --silent 2>/dev/null || npm ci
  npm run build

  echo "== Restart ptt-crm-api =="
  sudo -n /usr/bin/systemctl restart ptt-crm-api 2>/dev/null || sudo /usr/bin/systemctl restart ptt-crm-api
  systemctl is-active ptt-crm-api

  echo "Done. Re-login as admin@pttads.vn to refresh JWT caps."
}

if [[ "${1:-}" == "--local" ]]; then
  run_local
  exit 0
fi

if [[ "$APPLY" != "1" ]]; then
  echo "Dry-run. Set APPLY=1 to sync and deploy."
  echo "  APPLY=1 $0"
  exit 0
fi

sync_to_vps
ssh "${VPS_USER}@${VPS_HOST}" "chmod +x ${VPS_ROOT}/scripts/seed_hr_pii_rbac.sh ${VPS_ROOT}/scripts/deploy_hr_pii_rbac_vps.sh && bash ${VPS_ROOT}/scripts/deploy_hr_pii_rbac_vps.sh --local"
