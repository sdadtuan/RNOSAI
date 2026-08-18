#!/usr/bin/env bash
# Deploy B2B Lead Project OS — Phase 1 (DDL, API module, lead gate; flag OFF by default).
#
# From laptop:
#   APPLY=1 ./scripts/deploy_b2b_lead_project_os_p1_vps.sh
#
# Optional backfill legacy B2B leads → PTT-LEGACY:
#   BACKFILL=1 APPLY=1 ./scripts/deploy_b2b_lead_project_os_p1_vps.sh
#
# On VPS:
#   cd /var/www/rnosai && git pull --ff-only origin main && bash scripts/deploy_b2b_lead_project_os_p1_vps.sh --local
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VPS_HOST="${PTT_VPS_HOST:-rs.pttads.vn}"
VPS_USER="${PTT_VPS_USER:-deploy}"
VPS_ROOT="${PTT_VPS_ROOT:-/var/www/rnosai}"
APPLY="${APPLY:-0}"
BACKFILL="${BACKFILL:-0}"

run_local() {
  echo "== B2B Lead Project OS P1 deploy @ $(git -C "$ROOT" rev-parse --short HEAD) =="
  cd "$ROOT"

  if [[ -f "$ROOT/.env" ]]; then
    set -a
    # shellcheck disable=SC1091
    source "$ROOT/.env"
    set +a
  fi

  echo "== 1/4 Apply DDL =="
  bash "$ROOT/scripts/apply_pg_ddl_b2b_lead_project_os.sh"

  echo "== 2/4 RBAC crm_b2b_projects caps =="
  python3 "$ROOT/scripts/migrate_b2b_projects_permissions.py" --apply

  if [[ "$BACKFILL" == "1" ]]; then
    echo "== Backfill B2B leads → PTT-LEGACY =="
    psql "${DATABASE_URL:?DATABASE_URL required}" -v ON_ERROR_STOP=1 \
      -f "$ROOT/scripts/backfill_b2b_leads_ptt_legacy.sql"
  else
    echo "== Backfill skipped (set BACKFILL=1 to run PTT-LEGACY backfill) =="
  fi

  echo "== 3/4 ptt-crm-api build + test =="
  cd "$ROOT/services/ptt-crm-api"
  npm ci
  export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=2048}"
  npm run build
  npm test -- --testPathPattern='src/b2b-projects|lead-create-enrichment.service.spec' --no-coverage

  echo "== 4/4 restart ptt-crm-api =="
  sudo -n /usr/bin/systemctl restart ptt-crm-api 2>/dev/null || true
  sleep 3
  curl -sf http://127.0.0.1:3000/health -o /dev/null && echo " api OK" || echo "WARN  api health check failed"

  echo "== B2B Lead Project OS P1 deploy complete =="
  echo "Flag PTT_B2B_PROJECT_OS stays OFF unless set in deploy/runtime.env (prod-safe)."
  echo "Enable after UAT: PTT_B2B_PROJECT_OS=1 on ptt-crm-api service env."
}

if [[ "${1:-}" == "--local" ]]; then
  run_local
elif [[ "$APPLY" == "1" ]]; then
  ssh "${VPS_USER}@${VPS_HOST}" "cd ${VPS_ROOT} && git pull --ff-only origin main && BACKFILL=${BACKFILL} bash scripts/deploy_b2b_lead_project_os_p1_vps.sh --local"
else
  echo "Dry-run. Set APPLY=1 to deploy to ${VPS_USER}@${VPS_HOST}:${VPS_ROOT}"
  echo "Or on VPS: bash scripts/deploy_b2b_lead_project_os_p1_vps.sh --local"
fi
