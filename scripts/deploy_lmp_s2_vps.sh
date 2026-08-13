#!/usr/bin/env bash
# Deploy S-LMP-2 — Lead Meeting Prep MVP UI + RBAC + gate flags on VPS.
#
# From laptop:
#   APPLY=1 ./scripts/deploy_lmp_s2_vps.sh
#
# On VPS directly:
#   cd /var/www/rnosai && git pull origin main && bash scripts/deploy_lmp_s2_vps.sh --local
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VPS_HOST="${PTT_VPS_HOST:-rs.pttads.vn}"
VPS_USER="${PTT_VPS_USER:-deploy}"
VPS_ROOT="${PTT_VPS_ROOT:-/var/www/rnosai}"
APPLY="${APPLY:-0}"

patch_runtime_env() {
  local env_file="$1"
  [[ -f "$env_file" ]] || return 0
  for kv in \
    "PTT_LEAD_MEETING_PREP_ENABLED=1" \
    "PTT_JOBS_ENABLED=1" \
    "NEXT_PUBLIC_LEAD_MEETING_PREP=1"; do
    key="${kv%%=*}"
    if grep -q "^${key}=" "$env_file" 2>/dev/null; then
      sed -i.bak "s|^${key}=.*|${kv}|" "$env_file"
    else
      echo "$kv" >> "$env_file"
    fi
  done
}

run_local() {
  cd "$ROOT"
  echo "== S-LMP-2 deploy @ $(git rev-parse --short HEAD) =="

  if [[ -f "$ROOT/.env" ]]; then
    set -a
    # shellcheck disable=SC1091
    source "$ROOT/.env"
    set +a
  fi
  export DATABASE_URL="${DATABASE_URL:-postgresql://ptt:ptt_dev@127.0.0.1:5433/rnosaidb}"

  echo "== DDL LMP (idempotent) =="
  bash "$ROOT/scripts/apply_pg_ddl_lead_meeting_prep.sh"

  echo "== RBAC seed crm_lmp =="
  python3 "$ROOT/scripts/seed_staff_lmp_permissions.py"

  echo "== Nest ptt-crm-api =="
  cd "$ROOT/services/ptt-crm-api"
  npm ci
  npm run build
  npm test -- --testPathPattern="lead-meeting-prep|staff-lmp" --passWithNoTests
  sudo -n /usr/bin/systemctl restart ptt-crm-api
  sleep 2
  curl -sf http://127.0.0.1:3000/health && echo " Nest OK"

  echo "== ops-web (LMP panel) =="
  cd "$ROOT"
  export NEXT_PUBLIC_PTT_API_URL="${NEXT_PUBLIC_PTT_API_URL:-https://rs.pttads.vn}"
  export NEXT_PUBLIC_LEAD_MEETING_PREP="${NEXT_PUBLIC_LEAD_MEETING_PREP:-1}"
  "$ROOT/scripts/deploy_ops_web.sh" build
  sudo -n /usr/bin/systemctl restart ptt-ops-web
  sleep 2
  curl -sf http://127.0.0.1:3200/login -o /dev/null && echo " ops-web OK"

  echo "== runtime flags =="
  patch_runtime_env "$ROOT/.env"
  patch_runtime_env "/etc/ptt/runtime.env" || true

  echo "== worker restart (requires DATABASE_URL in unit) =="
  sudo -n /usr/bin/systemctl restart ptt-worker || echo "WARN  ptt-worker restart failed — check DATABASE_URL"

  echo "== gate (unit, no Tavily) =="
  bash "$ROOT/scripts/lead_meeting_prep_gate.sh"

  echo "== S-LMP-2 deploy complete =="
  echo "Enable E2E on VPS: LMP_E2E=1 TAVILY_API_KEY=... bash scripts/lead_meeting_prep_gate.sh"
  echo "UAT: docs/runbooks/lmp-uat-p0.md"
}

if [[ "${1:-}" == "--local" ]]; then
  run_local
elif [[ "$APPLY" == "1" ]]; then
  ssh "${VPS_USER}@${VPS_HOST}" "cd ${VPS_ROOT} && git pull --ff-only origin main && bash scripts/deploy_lmp_s2_vps.sh --local"
else
  echo "Dry-run. Set APPLY=1 to deploy to ${VPS_USER}@${VPS_HOST}:${VPS_ROOT}"
  echo "Or on VPS: bash scripts/deploy_lmp_s2_vps.sh --local"
fi
