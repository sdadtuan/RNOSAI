#!/usr/bin/env bash
# Deploy CEO Command ChatBox + Lifecycle Tower T0–T2 (DDL + ptt-crm-api + ops-web).
# Do NOT export PTT_CEO_COMMAND_LLM=1 — OSS polish stays off on 3.3 GiB VPS.
# Tower needs no extra env: PTT_CEO_TOWER_LEGAL_ENTITY=0, PTT_CEO_BOARD_PACK_NOTIFY=0.
#
# From laptop:
#   APPLY=1 ./scripts/deploy_ceo_command_vps.sh
#
# On VPS:
#   cd /var/www/rnosai && git pull --ff-only origin main && bash scripts/deploy_ceo_command_vps.sh --local
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VPS_HOST="${PTT_VPS_HOST:-rs.pttads.vn}"
VPS_USER="${PTT_VPS_USER:-deploy}"
VPS_ROOT="${PTT_VPS_ROOT:-/var/www/rnosai}"
APPLY="${APPLY:-0}"

run_local() {
  echo "== CEO Command deploy @ $(git -C "$ROOT" rev-parse --short HEAD) =="
  cd "$ROOT"

  if [[ -f "$ROOT/.env" ]]; then
    set -a
    # shellcheck disable=SC1091
    source "$ROOT/.env"
    set +a
  fi

  echo "== 0/4 apply ceo_command DDL =="
  bash "$ROOT/scripts/apply_pg_ddl_ceo_command.sh"

  echo "== 1/4 ptt-crm-api build + ceo-command tests =="
  cd "$ROOT/services/ptt-crm-api"
  npm ci
  export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=2048}"
  npm run build
  npx jest --testPathPattern='src/ceo-command|src/playbooks/playbooks.repository.spec' --no-coverage

  echo "== 2/4 ops-web build =="
  cd "$ROOT"
  export NEXT_PUBLIC_PTT_API_URL="${NEXT_PUBLIC_PTT_API_URL:-https://rs.pttads.vn}"
  export NEXT_PUBLIC_PTT_CEO_COMMAND="${NEXT_PUBLIC_PTT_CEO_COMMAND:-1}"
  "$ROOT/scripts/deploy_ops_web.sh" build
  cd "$ROOT/services/ops-web"
  npx vitest run \
    src/lib/crm/ceo-command-thread.util.spec.ts \
    src/lib/crm/ceo-command-nl-render.util.spec.ts \
    src/lib/crm/ceo-tower-ui.util.spec.ts \
    src/lib/crm/ceo-tower-suggest.util.spec.ts

  echo "== 3/4 restart services (local systemd if present) =="
  if command -v systemctl >/dev/null 2>&1; then
    sudo systemctl restart ptt-crm-api ptt-ops-web 2>/dev/null || true
  fi

  echo "OK  CEO Command deployed (LLM flag not enabled)"
}

if [[ "${1:-}" == "--local" ]]; then
  run_local
  exit 0
fi

if [[ "$APPLY" != "1" ]]; then
  echo "Dry run. Set APPLY=1 to deploy to $VPS_USER@$VPS_HOST:$VPS_ROOT"
  exit 0
fi

ssh "$VPS_USER@$VPS_HOST" "cd '$VPS_ROOT' && git pull --ff-only origin main && bash scripts/deploy_ceo_command_vps.sh --local"
