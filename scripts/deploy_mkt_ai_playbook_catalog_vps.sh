#!/usr/bin/env bash
# MKT-AI Playbook Catalog + Learn — VPS deploy (policy DB, versions, Admin UI)
#
# From laptop:
#   APPLY=1 ./scripts/deploy_mkt_ai_playbook_catalog_vps.sh
#
# On VPS:
#   cd /var/www/rnosai && bash scripts/deploy_mkt_ai_playbook_catalog_vps.sh --local
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VPS_HOST="${PTT_VPS_HOST:-rs.pttads.vn}"
VPS_USER="${PTT_VPS_USER:-deploy}"
VPS_ROOT="${PTT_VPS_ROOT:-/var/www/rnosai}"
APPLY="${APPLY:-0}"
LEARN_ENABLED="${PTT_MKT_AI_PLAYBOOK_LEARN_ENABLED:-0}"

run_local() {
  cd "$ROOT"
  echo "== MKT-AI playbook catalog deploy @ $(git rev-parse --short HEAD 2>/dev/null || echo unknown) =="

  if [[ -f "$ROOT/.env" ]]; then
    set -a
    # shellcheck disable=SC1091
    source "$ROOT/.env"
    set +a
  fi

  echo "== 1/7 Apply DDL (planner + policy + versions) =="
  bash "$ROOT/scripts/apply_pg_ddl_mkt_ai_planner.sh"
  bash "$ROOT/scripts/verify_mkt_ai_ddl.sh" || echo "WARN verify_mkt_ai_ddl failed"

  echo "== 2/7 Seed service policy =="
  psql "${DATABASE_URL:?DATABASE_URL required}" -v ON_ERROR_STOP=1 \
    -f "$ROOT/scripts/seed_mkt_ai_service_policy.sql"

  echo "== 3/7 Import shipped playbook versions =="
  cd "$ROOT/services/ptt-crm-api"
  NODE_PATH=./node_modules npx tsx "$ROOT/scripts/seed_mkt_ai_playbook_versions.ts"
  cd "$ROOT"

  echo "== 4/7 Verify playbook JSON =="
  bash "$ROOT/scripts/verify_mkt_ai_playbooks.sh"

  echo "== 5/7 Runtime flags (policy-first; empty PLANNER_SLUGS) =="
  RUNTIME_ENV="$ROOT/deploy/runtime.env"
  mkdir -p "$ROOT/deploy"
  touch "$RUNTIME_ENV"
  for kv in \
    "PTT_MKT_AI_PLANNER_ENABLED=1" \
    "PTT_MKT_AI_PLANNER_SLUGS=" \
    "PTT_MKT_AI_PLAYBOOKS_ENABLED=1" \
    "PTT_MKT_AI_PLAYBOOK_LEARN_ENABLED=${LEARN_ENABLED}" \
    "NEXT_PUBLIC_MKT_AI_PLANNER=1"; do
    key="${kv%%=*}"
    if grep -q "^${key}=" "$RUNTIME_ENV" 2>/dev/null; then
      sed -i.bak "s|^${key}=.*|${kv}|" "$RUNTIME_ENV"
    else
      echo "$kv" >>"$RUNTIME_ENV"
    fi
  done
  echo "Updated $RUNTIME_ENV (PLANNER_SLUGS empty = policy DB only)"

  echo "== 6/7 Build API + ops-web =="
  cd "$ROOT/services/ptt-crm-api"
  npm ci
  export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=2048}"
  npm run build
  cd "$ROOT"
  if [[ -x "$ROOT/scripts/deploy_ops_web.sh" ]]; then
    NEXT_PUBLIC_MKT_AI_PLANNER=1 bash "$ROOT/scripts/deploy_ops_web.sh" --restart 2>/dev/null \
      || NEXT_PUBLIC_MKT_AI_PLANNER=1 bash "$ROOT/scripts/deploy_ops_web.sh" \
      || echo "WARN ops-web deploy failed"
  fi

  echo "== 7/7 Restart services + smoke =="
  if sudo -n /usr/bin/systemctl restart ptt-crm-api 2>/dev/null; then
    sleep 3
    curl -sf http://127.0.0.1:3000/health && echo " Nest OK"
  else
    echo "WARN: sudo systemctl restart ptt-crm-api manually"
  fi
  if sudo -n /usr/bin/systemctl restart ptt-ops-web 2>/dev/null; then
    echo "ops-web restarted"
  fi

  export PTT_API_URL="${PTT_API_URL:-http://127.0.0.1:3000}"
  bash "$ROOT/scripts/smoke_mkt_ai_playbooks_admin.sh" || echo "WARN admin playbooks smoke failed"

  echo "== MKT-AI playbook catalog deploy complete =="
  echo "Admin UI: https://${VPS_HOST}/crm/admin/mkt-ai/playbooks"
  echo "Learn flag: PTT_MKT_AI_PLAYBOOK_LEARN_ENABLED=${LEARN_ENABLED}"
}

if [[ "${1:-}" == "--local" ]]; then
  run_local
elif [[ "$APPLY" == "1" ]]; then
  echo "== SSH ${VPS_USER}@${VPS_HOST}:${VPS_ROOT} =="
  ssh "${VPS_USER}@${VPS_HOST}" \
    "cd ${VPS_ROOT} && git pull --ff-only origin main && \
     PTT_MKT_AI_PLAYBOOK_LEARN_ENABLED=${LEARN_ENABLED} \
     bash scripts/deploy_mkt_ai_playbook_catalog_vps.sh --local"
else
  echo "Dry-run. Set APPLY=1 to deploy on ${VPS_USER}@${VPS_HOST}:${VPS_ROOT}"
  echo "Optional: PTT_MKT_AI_PLAYBOOK_LEARN_ENABLED=1 APPLY=1 ./scripts/deploy_mkt_ai_playbook_catalog_vps.sh"
fi
