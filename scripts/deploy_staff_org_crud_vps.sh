#!/usr/bin/env bash
# Deploy staff org CRUD (departments / teams / positions) + API on VPS.
#
# From laptop:
#   APPLY=1 ./scripts/deploy_staff_org_crud_vps.sh
#
# On VPS directly:
#   cd /var/www/rnosai && git pull --ff-only origin main && bash scripts/deploy_staff_org_crud_vps.sh --local
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VPS_HOST="${PTT_VPS_HOST:-rs.pttads.vn}"
VPS_USER="${PTT_VPS_USER:-deploy}"
VPS_ROOT="${PTT_VPS_ROOT:-/var/www/rnosai}"
APPLY="${APPLY:-0}"

sync_to_vps() {
  echo "== Rsync sources to ${VPS_USER}@${VPS_HOST} =="
  rsync -av \
    "$ROOT/services/ptt-crm-api/src/staff-org/" \
    "${VPS_USER}@${VPS_HOST}:${VPS_ROOT}/services/ptt-crm-api/src/staff-org/"
  rsync -av \
    "$ROOT/services/ptt-crm-api/src/leads/pg-leads-write.repository.ts" \
    "${VPS_USER}@${VPS_HOST}:${VPS_ROOT}/services/ptt-crm-api/src/leads/pg-leads-write.repository.ts"
  rsync -av \
    "$ROOT/services/ops-web/src/app/admin/crm/org/departments/page.tsx" \
    "${VPS_USER}@${VPS_HOST}:${VPS_ROOT}/services/ops-web/src/app/admin/crm/org/departments/page.tsx"
  rsync -av \
    "$ROOT/services/ops-web/src/app/admin/crm/org/teams/page.tsx" \
    "${VPS_USER}@${VPS_HOST}:${VPS_ROOT}/services/ops-web/src/app/admin/crm/org/teams/page.tsx"
  rsync -av \
    "$ROOT/services/ops-web/src/app/admin/crm/org/positions/page.tsx" \
    "${VPS_USER}@${VPS_HOST}:${VPS_ROOT}/services/ops-web/src/app/admin/crm/org/positions/page.tsx"
  rsync -av \
    "$ROOT/services/ops-web/src/components/rbac/OrgStructureRowActions.tsx" \
    "${VPS_USER}@${VPS_HOST}:${VPS_ROOT}/services/ops-web/src/components/rbac/OrgStructureRowActions.tsx"
  rsync -av \
    "$ROOT/services/ops-web/src/lib/api.ts" \
    "${VPS_USER}@${VPS_HOST}:${VPS_ROOT}/services/ops-web/src/lib/api.ts"
  rsync -av \
    "$ROOT/scripts/deploy_staff_org_crud_vps.sh" \
    "${VPS_USER}@${VPS_HOST}:${VPS_ROOT}/scripts/deploy_staff_org_crud_vps.sh"
}

run_local() {
  cd "$ROOT"
  echo "== Staff org CRUD deploy @ $(git rev-parse --short HEAD) =="

  if [[ -f "$ROOT/.env" ]]; then
    set -a
    # shellcheck disable=SC1091
    source "$ROOT/.env"
    set +a
  fi

  echo "== Build ptt-crm-api =="
  cd "$ROOT/services/ptt-crm-api"
  npm ci --silent 2>/dev/null || npm ci
  npm run build
  npm test -- --testPathPattern=staff-org.repository.spec --passWithNoTests
  sudo -n /usr/bin/systemctl restart ptt-crm-api
  sleep 2
  curl -sf http://127.0.0.1:3000/health && echo " Nest OK"

  echo "== Build ops-web =="
  cd "$ROOT"
  export NEXT_PUBLIC_PTT_API_URL="${NEXT_PUBLIC_PTT_API_URL:-https://rs.pttads.vn}"
  export NEXT_PUBLIC_WIN_ORG_UI="${NEXT_PUBLIC_WIN_ORG_UI:-1}"
  "$ROOT/scripts/deploy_ops_web.sh" build
  sudo -n /usr/bin/systemctl restart ptt-ops-web
  sleep 2
  curl -sf http://127.0.0.1:3200/login -o /dev/null && echo " ops-web OK"

  echo "== Staff org CRUD deploy complete =="
  echo "UI: https://rs.pttads.vn/admin/crm/org/departments"
}

if [[ "${1:-}" == "--local" ]]; then
  run_local
elif [[ "$APPLY" == "1" ]]; then
  sync_to_vps
  ssh "${VPS_USER}@${VPS_HOST}" "chmod +x ${VPS_ROOT}/scripts/deploy_staff_org_crud_vps.sh && bash ${VPS_ROOT}/scripts/deploy_staff_org_crud_vps.sh --local"
else
  echo "Dry-run. Set APPLY=1 to deploy to ${VPS_USER}@${VPS_HOST}:${VPS_ROOT}"
  echo "Or on VPS: bash scripts/deploy_staff_org_crud_vps.sh --local"
fi
