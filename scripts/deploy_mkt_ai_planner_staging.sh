#!/usr/bin/env bash
# MKT-AI S1 — Apply DDL + flags + smoke on staging VPS (rs.pttads.vn)
#
# From laptop:
#   APPLY=1 ./scripts/deploy_mkt_ai_planner_staging.sh
#
# On VPS directly:
#   cd /var/www/rnosai && bash scripts/deploy_mkt_ai_planner_staging.sh --local
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VPS_HOST="${PTT_VPS_HOST:-rs.pttads.vn}"
VPS_USER="${PTT_VPS_USER:-deploy}"
VPS_ROOT="${PTT_VPS_ROOT:-/var/www/rnosai}"
APPLY="${APPLY:-0}"

run_local() {
  cd "$ROOT"
  echo "== MKT-AI planner staging kickoff @ $(git rev-parse --short HEAD 2>/dev/null || echo unknown) =="

  if [[ -f "$ROOT/.env" ]]; then
    set -a
    # shellcheck disable=SC1091
    source "$ROOT/.env"
    set +a
  fi

  echo "== 1/5 Apply DDL =="
  bash "$ROOT/scripts/apply_pg_ddl_mkt_ai_planner.sh"

  echo "== 2/5 Verify DDL =="
  bash "$ROOT/scripts/verify_mkt_ai_ddl.sh"

  echo "== 3/5 Enable API + FE flags =="
  RUNTIME_ENV="$ROOT/deploy/runtime.env"
  mkdir -p "$ROOT/deploy"
  touch "$RUNTIME_ENV"
  for kv in \
    "PTT_MKT_AI_PLANNER_ENABLED=1" \
    "PTT_MKT_AI_PLANNER_SLUGS=meta-lead-gen" \
    "NEXT_PUBLIC_MKT_AI_PLANNER=1"; do
    key="${kv%%=*}"
    if grep -q "^${key}=" "$RUNTIME_ENV" 2>/dev/null; then
      sed -i.bak "s|^${key}=.*|${kv}|" "$RUNTIME_ENV"
    else
      echo "$kv" >>"$RUNTIME_ENV"
    fi
  done
  echo "Updated $RUNTIME_ENV"

  for kv in \
    "PTT_MKT_AI_PLANNER_ENABLED=1" \
    "PTT_MKT_AI_PLANNER_SLUGS=meta-lead-gen"; do
    key="${kv%%=*}"
    if [[ -f "$ROOT/.env" && -w "$ROOT/.env" ]]; then
      if grep -q "^${key}=" "$ROOT/.env" 2>/dev/null; then
        sed -i.bak "s|^${key}=.*|${kv}|" "$ROOT/.env"
      else
        echo "$kv" >>"$ROOT/.env"
      fi
    else
      echo "SKIP .env update (not writable) — runtime.env overrides apply"
    fi
  done

  echo "== 4/5 Restart Nest API (if systemd available) =="
  if sudo -n /usr/bin/systemctl restart ptt-crm-api 2>/dev/null; then
    sleep 3
    curl -sf http://127.0.0.1:3000/health && echo " Nest OK"
  else
    echo "SKIP systemd restart (no passwordless sudo or not on VPS)"
    echo "     Manual: sudo systemctl restart ptt-crm-api"
  fi

  echo "== 4b/5 Seed UAT lifecycle (PG pilot slug) =="
  if [[ -n "${DATABASE_URL:-}" ]]; then
    bash "$ROOT/scripts/seed_mkt_ai_uat_lifecycle.sh" || echo "WARN seed failed — set LIFECYCLE_ID manually"
  else
    echo "SKIP seed — DATABASE_URL not set"
  fi

  echo "== 5/5 Smoke ai-planner/context =="
  export PTT_API_URL="${PTT_API_URL:-http://127.0.0.1:3000}"
  export ADMIN_EMAIL="${OPS_E2E_STAFF_EMAIL:-admin@pttads.vn}"
  export ADMIN_PASSWORD="${OPS_E2E_STAFF_PASSWORD:-${ADMIN_PASSWORD:-}}"
  export PTT_CRM_INTERNAL_KEY="${PTT_CRM_INTERNAL_KEY:-}"
  bash "$ROOT/scripts/smoke_mkt_ai_planner_context.sh"

  echo "== MKT-AI staging kickoff complete =="
  echo "Flags: PTT_MKT_AI_PLANNER_ENABLED=1 PTT_MKT_AI_PLANNER_SLUGS=meta-lead-gen NEXT_PUBLIC_MKT_AI_PLANNER=1"
  echo "Ops-web: rebuild with NEXT_PUBLIC_MKT_AI_PLANNER=1 to show tab (deploy_ops_web.sh)"
}

if [[ "${1:-}" == "--local" ]]; then
  run_local
elif [[ "$APPLY" == "1" ]]; then
  echo "== SSH ${VPS_USER}@${VPS_HOST}:${VPS_ROOT} =="
  ssh "${VPS_USER}@${VPS_HOST}" "cd ${VPS_ROOT} && git pull --ff-only origin main && bash scripts/deploy_mkt_ai_planner_staging.sh --local"
else
  echo "Dry-run. Set APPLY=1 to run on ${VPS_USER}@${VPS_HOST}:${VPS_ROOT}"
  echo "Or on VPS: bash scripts/deploy_mkt_ai_planner_staging.sh --local"
fi
