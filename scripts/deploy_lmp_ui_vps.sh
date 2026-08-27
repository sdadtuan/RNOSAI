#!/usr/bin/env bash
# Enable Lead Meeting Prep UI on VPS: runtime.env flag + ops-web rebuild.
#
# From laptop:
#   APPLY=1 ./scripts/deploy_lmp_ui_vps.sh
#
# On VPS:
#   cd /var/www/rnosai && git pull --ff-only origin main && bash scripts/deploy_lmp_ui_vps.sh --local
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VPS_HOST="${PTT_VPS_HOST:-rs.pttads.vn}"
VPS_USER="${PTT_VPS_USER:-deploy}"
VPS_ROOT="${PTT_VPS_ROOT:-/var/www/rnosai}"
APPLY="${APPLY:-0}"
RUNTIME_ENV="${PTT_RUNTIME_ENV:-${VPS_ROOT}/deploy/runtime.env}"

patch_runtime_env() {
  local env_file="$1"
  mkdir -p "$(dirname "$env_file")"
  touch "$env_file"
  local kv="NEXT_PUBLIC_LEAD_MEETING_PREP=1"
  local key="${kv%%=*}"
  if grep -q "^${key}=" "$env_file" 2>/dev/null; then
    sed -i.bak "s|^${key}=.*|${kv}|" "$env_file"
  else
    echo "$kv" >>"$env_file"
  fi
  echo "OK  $env_file → $kv"
}

run_local() {
  cd "$ROOT"
  echo "== LMP UI enable @ $(git rev-parse --short HEAD 2>/dev/null || echo local) =="

  patch_runtime_env "$RUNTIME_ENV"

  echo "== ops-web rebuild (reads deploy/runtime.env) =="
  "$ROOT/scripts/deploy_ops_web.sh" build

  if sudo -n systemctl restart ptt-ops-web 2>/dev/null; then
    sleep 2
    systemctl is-active ptt-ops-web && echo "OK  ptt-ops-web restarted"
  else
    echo ""
    echo "Build OK. Restart requires sudo — run as root:"
    echo "  sudo systemctl restart ptt-ops-web"
  fi

  echo ""
  echo "Verify: open https://rs.pttads.vn/crm/leads/{id} (B2B lead) → nút Sales Cockpit"
}

if [[ "${1:-}" == "--local" ]]; then
  run_local
  exit 0
fi

if [[ "$APPLY" != "1" ]]; then
  echo "Dry-run. Set APPLY=1 to patch runtime.env + rebuild ops-web on ${VPS_USER}@${VPS_HOST}"
  exit 0
fi

ssh "${VPS_USER}@${VPS_HOST}" "cd ${VPS_ROOT} && git pull --ff-only origin main && chmod +x scripts/deploy_lmp_ui_vps.sh && bash scripts/deploy_lmp_ui_vps.sh --local"
