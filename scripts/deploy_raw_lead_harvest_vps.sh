#!/usr/bin/env bash
# Deploy Market Research Raw Lead Harvest Wave A+B (api + ops-web).
# DDL is ensureSchema on first API hit (providers + harvest jobs/leads).
#
# Flags (build + runtime):
#   NEXT_PUBLIC_RESEARCH_RAW_LEAD_HARVEST=1  (ops-web tab)
#   PTT_RESEARCH_RAW_LEAD_HARVEST=1          (api gate)
#   PTT_RESEARCH_HARVEST_MOCK=0              (real AI worker; 1 = mock)
#   PTT_RESEARCH_HARVEST_LEGAL_ENRICH=1      (optional H3c MST/Places score boost)
#   PTT_SECRET_ENCRYPT_KEY                  (32-byte; reuse CP encrypt key)
#
# From laptop:
#   APPLY=1 ./scripts/deploy_raw_lead_harvest_vps.sh
#
# On VPS:
#   cd /var/www/rnosai && git pull --ff-only origin main && bash scripts/deploy_raw_lead_harvest_vps.sh --local
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VPS_HOST="${PTT_VPS_HOST:-rs.pttads.vn}"
VPS_USER="${PTT_VPS_USER:-deploy}"
VPS_ROOT="${PTT_VPS_ROOT:-/var/www/rnosai}"
APPLY="${APPLY:-0}"

ensure_runtime_flag() {
  local key="$1"
  local value="$2"
  local env_file="$ROOT/deploy/runtime.env"
  mkdir -p "$(dirname "$env_file")"
  touch "$env_file"
  if grep -qE "^${key}=" "$env_file" 2>/dev/null; then
    echo " keep ${key}=$(grep -E "^${key}=" "$env_file" | tail -1 | cut -d= -f2-)"
  else
    echo "${key}=${value}" >>"$env_file"
    echo " set  ${key}=${value}"
  fi
}

export_public_flags_from_runtime() {
  local env_file="$ROOT/deploy/runtime.env"
  [[ -f "$env_file" ]] || return 0
  local line
  line="$(grep -E '^NEXT_PUBLIC_MARKET_RESEARCH=' "$env_file" | tail -1 || true)"
  if [[ -n "$line" ]]; then
    export NEXT_PUBLIC_MARKET_RESEARCH="${line#NEXT_PUBLIC_MARKET_RESEARCH=}"
  fi
  line="$(grep -E '^NEXT_PUBLIC_RESEARCH_RAW_LEAD_HARVEST=' "$env_file" | tail -1 || true)"
  if [[ -n "$line" ]]; then
    export NEXT_PUBLIC_RESEARCH_RAW_LEAD_HARVEST="${line#NEXT_PUBLIC_RESEARCH_RAW_LEAD_HARVEST=}"
  fi
}

hup_or_warn() {
  local unit="$1"
  if sudo -n systemctl restart "$unit" 2>/dev/null; then
    return 0
  fi
  echo "WARN  sudo systemctl restart ${unit} skipped"
  if systemctl is-active --quiet "$unit" 2>/dev/null; then
    local pid
    pid="$(systemctl show "$unit" -p MainPID --value 2>/dev/null || true)"
    if [[ -n "$pid" && "$pid" != "0" ]] && kill -HUP "$pid" 2>/dev/null; then
      echo "OK  ${unit} HUP pid=${pid}"
      return 0
    fi
  fi
  echo "      Run: sudo systemctl restart ${unit}"
  return 0
}

run_local() {
  echo "== Raw Lead Harvest Wave A+B deploy @ $(git -C "$ROOT" rev-parse --short HEAD) =="
  cd "$ROOT"

  if [[ -f "$ROOT/.env" ]]; then
    set -a
    # shellcheck disable=SC1091
    source "$ROOT/.env"
    set +a
  fi

  echo "== 0/4 runtime flags =="
  ensure_runtime_flag PTT_RESEARCH_RAW_LEAD_HARVEST 1
  ensure_runtime_flag PTT_RESEARCH_HARVEST_MOCK 1
  ensure_runtime_flag NEXT_PUBLIC_RESEARCH_RAW_LEAD_HARVEST 1
  if ! grep -qE '^PTT_SECRET_ENCRYPT_KEY=.{16,}' "$ROOT/deploy/runtime.env" 2>/dev/null \
    && [[ -z "${PTT_SECRET_ENCRYPT_KEY:-}" ]]; then
    echo "WARN  PTT_SECRET_ENCRYPT_KEY missing — Admin token encrypt/test will 503 until set (32 utf8 bytes)"
  else
    echo " OK   PTT_SECRET_ENCRYPT_KEY present (env or runtime.env)"
  fi

  echo "== 1/4 ptt-crm-api build + harvest tests =="
  cd "$ROOT/services/ptt-crm-api"
  npm ci
  export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=2048}"
  npm run build
  npx jest --testPathPattern='raw-lead-harvest|crm-config-pg.repository.spec' --no-coverage

  echo "== 2/4 ops-web build =="
  cd "$ROOT"
  export_public_flags_from_runtime
  export NEXT_PUBLIC_PTT_API_URL="${NEXT_PUBLIC_PTT_API_URL:-https://rs.pttads.vn}"
  export NEXT_PUBLIC_RESEARCH_RAW_LEAD_HARVEST="${NEXT_PUBLIC_RESEARCH_RAW_LEAD_HARVEST:-1}"
  echo " NEXT_PUBLIC_RESEARCH_RAW_LEAD_HARVEST=${NEXT_PUBLIC_RESEARCH_RAW_LEAD_HARVEST}"
  "$ROOT/scripts/deploy_ops_web.sh" build

  echo "== 3/4 restart services =="
  if command -v systemctl >/dev/null 2>&1; then
    hup_or_warn ptt-crm-api
    hup_or_warn ptt-ops-web
    sleep 3
    systemctl is-active ptt-crm-api ptt-ops-web || true
    curl -sf http://127.0.0.1:3000/health -o /dev/null && echo " api OK" || echo "WARN  api health check failed"
    curl -sf http://127.0.0.1:3200/login -o /dev/null && echo " ops-web OK" || echo "WARN  ops-web health check failed"
  fi

  echo "== 4/4 done =="
  echo "Admin:  /admin/crm/research-ai-providers"
  echo "        /admin/crm/lead-lookups (Ngành nghề / Chức danh)"
  echo "Staff:  /crm/research/[id]?tab=raw_leads"
  echo "API:    GET  /api/v1/research/raw-lead-harvest/providers"
  echo "        POST /api/v1/research/projects/:id/raw-lead-harvests"
}

if [[ "${1:-}" == "--local" ]]; then
  run_local
  exit 0
fi

if [[ "$APPLY" != "1" ]]; then
  echo "Dry run. Set APPLY=1 to deploy to $VPS_USER@$VPS_HOST:$VPS_ROOT"
  exit 0
fi

ssh "$VPS_USER@$VPS_HOST" "cd '$VPS_ROOT' && git pull --ff-only origin main && bash scripts/deploy_raw_lead_harvest_vps.sh --local"
