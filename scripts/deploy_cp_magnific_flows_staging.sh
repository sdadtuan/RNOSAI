#!/usr/bin/env bash
# Deploy SPEC-CP-MAGNIFIC-FLOWS (Wave B+ — Flow REST + catalog + pane).
# Does NOT enable MAGNIFIC_FLOWS_ENABLED — set manually after UAT (see docs/runbooks/cp-magnific-flows.md).
#
# From laptop:
#   APPLY=1 ./scripts/deploy_cp_magnific_flows_staging.sh
#
# Optional seed (after sqid replaced in SQL):
#   APPLY=1 SEED=1 ./scripts/deploy_cp_magnific_flows_staging.sh
#
# On VPS:
#   cd /var/www/rnosai && git pull --ff-only origin main && bash scripts/deploy_cp_magnific_flows_staging.sh --local
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VPS_HOST="${PTT_VPS_HOST:-rs.pttads.vn}"
VPS_USER="${PTT_VPS_USER:-deploy}"
VPS_ROOT="${PTT_VPS_ROOT:-/var/www/rnosai}"
APPLY="${APPLY:-0}"
SEED="${SEED:-0}"

run_local() {
  echo "== CP Magnific Flows (B+) deploy @ $(git -C "$ROOT" rev-parse --short HEAD) =="
  cd "$ROOT"

  if [[ -f "$ROOT/.env" ]]; then
    set -a
    # shellcheck disable=SC1091
    source "$ROOT/.env"
    set +a
  fi

  echo "== 0/5 apply Magnific Flows DDL (idempotent) =="
  bash "$ROOT/scripts/apply_pg_ddl_cp_magnific_flows.sh"

  if [[ "$SEED" == "1" ]]; then
    echo "== 0b/5 seed flow templates (staging) =="
    if grep -q 'REPLACE_WITH_SQID' "$ROOT/scripts/seed_cp_magnific_flow_templates_staging.sql"; then
      echo "WARN  seed still contains REPLACE_WITH_SQID — update sqid before prod/staging UAT" >&2
    fi
    URL="${DATABASE_URL:-}"
    if [[ -z "$URL" ]]; then
      echo "FAIL  SEED=1 requires DATABASE_URL in .env" >&2
      exit 1
    fi
    psql "$URL" -v ON_ERROR_STOP=1 -f "$ROOT/scripts/seed_cp_magnific_flow_templates_staging.sql"
  else
    echo "== skip seed (set SEED=1 to apply scripts/seed_cp_magnific_flow_templates_staging.sql) =="
  fi

  echo "== 1/5 ptt-crm-api build + Magnific Flow unit tests =="
  cd "$ROOT/services/ptt-crm-api"
  npm ci
  export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=2048}"
  npm run build
  npx jest --config jest.config.js --testPathPattern='cp-magnific-flow|cp-jobs.service.spec|cp-ai-ops.flags.spec' --forceExit --no-coverage

  echo "== 2/5 ops-web Magnific Flow unit + E2E spec file check =="
  cd "$ROOT/services/ops-web"
  npm ci
  npx vitest run src/lib/crm/cp-ai-ops-flow.util.spec.ts src/lib/crm/cp-ai-ops-panes.util.spec.ts

  echo "== 3/5 ops-web build =="
  cd "$ROOT"
  export NEXT_PUBLIC_PTT_API_URL="${NEXT_PUBLIC_PTT_API_URL:-https://rs.pttads.vn}"
  "$ROOT/scripts/deploy_ops_web.sh" build

  echo "== 4/5 restart services (one unit per command) =="
  if command -v systemctl >/dev/null 2>&1; then
    restarted=0
    for unit in ptt-crm-api ptt-ops-web; do
      if sudo -n /usr/bin/systemctl restart "$unit" 2>/dev/null; then
        echo "OK  restarted $unit"
        restarted=1
      else
        echo "WARN  sudo restart failed for $unit"
      fi
    done
    if [[ "$restarted" == "1" ]]; then
      sleep 4
      systemctl is-active ptt-crm-api
      systemctl is-active ptt-ops-web
    else
      echo "      Run: sudo /usr/bin/systemctl restart ptt-crm-api"
      echo "           sudo /usr/bin/systemctl restart ptt-ops-web"
    fi
  fi

  echo "== 5/5 post-deploy reminder =="
  echo "OK  Magnific Flows code deployed."
  echo "    MAGNIFIC_FLOWS_ENABLED unchanged — enable after UAT:"
  echo "      docs/runbooks/cp-magnific-flows.md §6"
}

if [[ "${1:-}" == "--local" ]]; then
  run_local
  exit 0
fi

if [[ "$APPLY" != "1" ]]; then
  echo "Dry run. Set APPLY=1 to deploy to $VPS_USER@$VPS_HOST:$VPS_ROOT"
  echo "Optional: SEED=1 to apply seed_cp_magnific_flow_templates_staging.sql"
  exit 0
fi

ssh "$VPS_USER@$VPS_HOST" "cd '$VPS_ROOT' && git pull --ff-only origin main && SEED='$SEED' bash scripts/deploy_cp_magnific_flows_staging.sh --local"
