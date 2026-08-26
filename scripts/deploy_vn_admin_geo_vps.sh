#!/usr/bin/env bash
# Deploy VN admin geo (provinces + wards catalog).
#
# From laptop:
#   APPLY=1 ./scripts/deploy_vn_admin_geo_vps.sh
#
# On VPS:
#   cd /var/www/rnosai && bash scripts/deploy_vn_admin_geo_vps.sh --local
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VPS_HOST="${PTT_VPS_HOST:-rs.pttads.vn}"
VPS_USER="${PTT_VPS_USER:-deploy}"
VPS_ROOT="${PTT_VPS_ROOT:-/var/www/rnosai}"
APPLY="${APPLY:-0}"

sync_to_vps() {
  rsync -av \
    "$ROOT/docs/specs/postgresql-ddl-vn-admin-geo.sql" \
    "$ROOT/scripts/apply_pg_ddl_vn_admin_geo.sh" \
    "$ROOT/scripts/seed_vn_admin_geo.js" \
    "$ROOT/scripts/deploy_vn_admin_geo_vps.sh" \
    "$ROOT/services/ptt-crm-api/src/vn-admin-geo/" \
    "${VPS_USER}@${VPS_HOST}:${VPS_ROOT}/services/ptt-crm-api/src/vn-admin-geo/"
  rsync -av \
    "$ROOT/docs/specs/postgresql-ddl-vn-admin-geo.sql" \
    "${VPS_USER}@${VPS_HOST}:${VPS_ROOT}/docs/specs/postgresql-ddl-vn-admin-geo.sql"
  rsync -av \
    "$ROOT/scripts/apply_pg_ddl_vn_admin_geo.sh" \
    "$ROOT/scripts/seed_vn_admin_geo.js" \
    "$ROOT/scripts/deploy_vn_admin_geo_vps.sh" \
    "${VPS_USER}@${VPS_HOST}:${VPS_ROOT}/scripts/"
  rsync -av \
    "$ROOT/services/ops-web/src/app/admin/crm/vn-geo/" \
    "${VPS_USER}@${VPS_HOST}:${VPS_ROOT}/services/ops-web/src/app/admin/crm/vn-geo/"
  rsync -av \
    "$ROOT/services/ops-web/src/lib/vn-geo-api.ts" \
    "${VPS_USER}@${VPS_HOST}:${VPS_ROOT}/services/ops-web/src/lib/vn-geo-api.ts"
  rsync -av \
    "$ROOT/services/ops-web/src/lib/hr/use-vn-geo.ts" \
    "${VPS_USER}@${VPS_HOST}:${VPS_ROOT}/services/ops-web/src/lib/hr/use-vn-geo.ts"
  rsync -av \
    "$ROOT/services/ops-web/src/lib/admin/admin-nav.ts" \
    "${VPS_USER}@${VPS_HOST}:${VPS_ROOT}/services/ops-web/src/lib/admin/admin-nav.ts"
  rsync -av \
    "$ROOT/services/ops-web/src/components/hr/AddressPairFields.tsx" \
    "$ROOT/services/ops-web/src/components/hr/EmployeeFileShell.tsx" \
    "${VPS_USER}@${VPS_HOST}:${VPS_ROOT}/services/ops-web/src/components/hr/"
  rsync -av \
    "${VPS_USER}@${VPS_HOST}:${VPS_ROOT}/services/ptt-crm-api/src/app.module.ts"
}

run_local() {
  cd "$ROOT"
  echo "== VN admin geo @ $(git rev-parse --short HEAD 2>/dev/null || echo local) =="
  if [[ -f "$ROOT/.env" ]]; then
    set -a
    # shellcheck disable=SC1091
    source "$ROOT/.env"
    set +a
  fi
  bash "$ROOT/scripts/apply_pg_ddl_vn_admin_geo.sh"
  cd "$ROOT/services/ptt-crm-api"
  npm ci --silent 2>/dev/null || npm ci
  NODE_PATH="$ROOT/services/ptt-crm-api/node_modules" node "$ROOT/scripts/seed_vn_admin_geo.js"
  npm run build
  sudo -n systemctl restart ptt-crm-api
  cd "$ROOT"
  bash scripts/deploy_ops_web.sh build
  sudo -n bash scripts/deploy_ops_web.sh --restart
  echo "Done."
}

if [[ "${1:-}" == "--local" ]]; then
  run_local
  exit 0
fi

if [[ "$APPLY" != "1" ]]; then
  echo "Dry-run. Set APPLY=1 to deploy."
  exit 0
fi

sync_to_vps
ssh "${VPS_USER}@${VPS_HOST}" "chmod +x ${VPS_ROOT}/scripts/apply_pg_ddl_vn_admin_geo.sh ${VPS_ROOT}/scripts/deploy_vn_admin_geo_vps.sh && bash ${VPS_ROOT}/scripts/deploy_vn_admin_geo_vps.sh --local"
