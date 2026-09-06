#!/usr/bin/env bash
# Deploy RevOps W3 — commission, SLA, territory/routing, KPI Hub commission UI.
#
# From laptop:
#   APPLY=1 ./scripts/deploy_revops_w3_vps.sh
#   APPLY=1 ./scripts/deploy_revops_w3_vps.sh --enable-flags
#
# On VPS:
#   cd /var/www/rnosai && git pull --ff-only origin main && bash scripts/deploy_revops_w3_vps.sh --local --enable-flags
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VPS_HOST="${PTT_VPS_HOST:-rs.pttads.vn}"
VPS_USER="${PTT_VPS_USER:-deploy}"
VPS_ROOT="${PTT_VPS_ROOT:-/var/www/rnosai}"
APPLY="${APPLY:-0}"
ENABLE_FLAGS=0
SKIP_E2E=0

for arg in "$@"; do
  case "$arg" in
    --enable-flags) ENABLE_FLAGS=1 ;;
    --skip-e2e) SKIP_E2E=1 ;;
  esac
done

run_local() {
  echo "== RevOps W3 deploy @ $(git -C "$ROOT" rev-parse --short HEAD) =="
  cd "$ROOT"

  if [[ -f "$ROOT/.env" ]]; then
    set -a
    # shellcheck disable=SC1091
    source "$ROOT/.env"
    set +a
  fi

  if [[ "$ENABLE_FLAGS" == "1" ]]; then
    export NEXT_PUBLIC_REVOPS_SHELL=1
    export NEXT_PUBLIC_LEAD_PIPELINE_TAB=1
    echo "== flags ON: REVOPS_SHELL + LEAD_PIPELINE_TAB (build-time) =="
  fi

  echo "== 1/8 RevOps RBAC catalog =="
  bash "$ROOT/scripts/seed_revops_rbac.sh"

  echo "== 2/8 PostgreSQL DDL (AM G1 + RevOps W3) =="
  bash "$ROOT/scripts/apply_pg_ddl_am_g1.sh"
  bash "$ROOT/scripts/apply_pg_ddl_revops_w3.sh"

  GATE_ARGS=()
  if [[ "$SKIP_E2E" == "1" ]]; then
    GATE_ARGS=(--skip-e2e)
  fi
  echo "== 3/8 RevOps W3 UAT gate =="
  bash "$ROOT/scripts/revops_w3_gate.sh" "${GATE_ARGS[@]}"

  echo "== 4/8 ptt-crm-api build =="
  cd "$ROOT/services/ptt-crm-api"
  npm ci
  export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=2048}"
  npm run build

  echo "== 5/8 ops-web build =="
  cd "$ROOT"
  export NEXT_PUBLIC_PTT_API_URL="${NEXT_PUBLIC_PTT_API_URL:-https://rs.pttads.vn}"
  "$ROOT/scripts/deploy_ops_web.sh" build

  echo "== 6/8 restart services =="
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

  echo "== 7/8 post-deploy API smoke (optional) =="
  if [[ -n "${DATABASE_URL:-}" ]]; then
    echo "OK  DATABASE_URL set — W3 tables should exist after step 2"
  else
    echo "SKIP DATABASE_URL unset — apply DDL manually on VPS"
  fi

  echo "== 8/8 sign-off reminder =="
  echo "OK  RevOps W3 deployed. PO sign-off: docs/evidence/revops-w3-signoff.template.json"
  echo "    Manual UAT: plan v1 → commission ≠ —; SLA queue; routing simulate; KPI Hub ?revops=1"
}

REMOTE_ARGS="--local"
if [[ "$ENABLE_FLAGS" == "1" ]]; then
  REMOTE_ARGS="--local --enable-flags"
fi
if [[ "$SKIP_E2E" == "1" ]]; then
  REMOTE_ARGS="$REMOTE_ARGS --skip-e2e"
fi

if [[ "${1:-}" == "--local" ]]; then
  run_local
  exit 0
fi

if [[ "$APPLY" != "1" ]]; then
  echo "Dry run. Set APPLY=1 to deploy to $VPS_USER@$VPS_HOST:$VPS_ROOT"
  echo "Optional: --enable-flags · --skip-e2e"
  exit 0
fi

ssh "$VPS_USER@$VPS_HOST" "cd '$VPS_ROOT' && git pull --ff-only origin main && bash scripts/deploy_revops_w3_vps.sh $REMOTE_ARGS"
