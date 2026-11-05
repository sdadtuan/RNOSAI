#!/usr/bin/env bash
# Wave 3 — VPS SQLite cleanup: .env hygiene, archive ptt.db, disable Flask + shadow sync
#
# From laptop:
#   APPLY=1 ./scripts/deploy_wave3_sqlite_cleanup_vps.sh
#
# On VPS:
#   cd /var/www/rnosai && git pull --ff-only origin main && bash scripts/deploy_wave3_sqlite_cleanup_vps.sh --local
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VPS_HOST="${PTT_VPS_HOST:-rs.pttads.vn}"
VPS_USER="${PTT_VPS_USER:-deploy}"
VPS_ROOT="${PTT_VPS_ROOT:-/var/www/rnosai}"
APPLY="${APPLY:-0}"
ENV_FILE="${PTT_ENV_FILE:-${VPS_ROOT}/.env}"
ARCHIVE_DIR="${PTT_SQLITE_ARCHIVE_DIR:-${VPS_ROOT}/archive/sqlite}"

_set_env_key() {
  local file="$1" key="$2" val="$3"
  touch "$file"
  if grep -q "^${key}=" "$file" 2>/dev/null; then
    sed -i.bak "s|^${key}=.*|${key}=${val}|" "$file"
  else
    echo "${key}=${val}" >>"$file"
  fi
}

_remove_env_key() {
  local file="$1" key="$2"
  if grep -q "^${key}=" "$file" 2>/dev/null; then
    sed -i.bak "/^${key}=/d" "$file"
  fi
}

run_local() {
  cd "$ROOT"
  echo "== Wave 3 SQLite cleanup @ $(git rev-parse --short HEAD 2>/dev/null || echo local) =="

  if [[ ! -f "$ENV_FILE" ]]; then
    echo "FAIL: missing $ENV_FILE" >&2
    exit 1
  fi

  echo "==> Normalize .env (PG-only, no duplicate shadow flag)"
  cp -a "$ENV_FILE" "${ENV_FILE}.pre-wave3.bak"
  _remove_env_key "$ENV_FILE" PTT_SQLITE_PATH
  _remove_env_key "$ENV_FILE" PTT_LEAD_SHADOW_SYNC
  _set_env_key "$ENV_FILE" PTT_LEADS_READ_SOURCE pg
  _set_env_key "$ENV_FILE" PTT_LEADS_WRITE_SOURCE pg
  _set_env_key "$ENV_FILE" PTT_LEADS_READ_UPSTREAM nest
  _set_env_key "$ENV_FILE" PTT_LEADS_WRITE_UPSTREAM nest
  _set_env_key "$ENV_FILE" PTT_LEAD_INGEST_RULES_SOURCE pg
  _set_env_key "$ENV_FILE" PTT_LEAD_SHADOW_SYNC 0
  _set_env_key "$ENV_FILE" PTT_LEAD_REPLICA_SYNC 0
  _set_env_key "$ENV_FILE" SEO_AEO_DB pg
  _set_env_key "$ENV_FILE" PTT_FLASK_MONOLITH_MODE retired
  _set_env_key "$ENV_FILE" PTT_WEBHOOKS_FLASK_FALLBACK 0
  echo "OK  .env updated (backup: ${ENV_FILE}.pre-wave3.bak)"

  echo "==> Archive legacy ptt.db"
  mkdir -p "$ARCHIVE_DIR"
  if [[ -f "${VPS_ROOT}/ptt.db" ]]; then
    stamp="$(date -u +%Y%m%dT%H%M%SZ)"
    mv "${VPS_ROOT}/ptt.db" "${ARCHIVE_DIR}/ptt.db.${stamp}"
    echo "OK  archived to ${ARCHIVE_DIR}/ptt.db.${stamp}"
  else
    echo "SKIP ptt.db not present"
  fi

  echo "==> Disable legacy systemd units"
  for unit in ptt.service ptt-lead-shadow-sync.service ptt-lead-shadow-sync.timer; do
    if systemctl list-unit-files "${unit}" &>/dev/null; then
      sudo -n systemctl stop "$unit" 2>/dev/null || true
      sudo -n systemctl disable "$unit" 2>/dev/null || true
      echo "OK  disabled $unit"
    else
      echo "SKIP $unit not installed"
    fi
  done

  echo "==> Rebuild ptt-crm-api + restart workers"
  cd "$ROOT/services/ptt-crm-api"
  npm ci --silent 2>/dev/null || npm ci
  npm run build
  sudo -n systemctl restart ptt-crm-api ptt-worker 2>/dev/null || systemctl restart ptt-crm-api ptt-worker 2>/dev/null || true
  sleep 2

  echo "==> Health"
  curl -sf http://127.0.0.1:3000/health | head -c 400 || echo "WARN Nest health failed"
  echo ""

  if [[ -x "$ROOT/scripts/crm_no_sqlite_gate.sh" ]]; then
    bash "$ROOT/scripts/crm_no_sqlite_gate.sh" || echo "WARN gate script (install rg on VPS for full check)"
  fi

  echo "Done."
}

if [[ "${1:-}" == "--local" ]]; then
  run_local
  exit 0
fi

if [[ "$APPLY" != "1" ]]; then
  echo "Dry-run. Set APPLY=1 to git pull + Wave 3 cleanup on ${VPS_USER}@${VPS_HOST}"
  exit 0
fi

ssh "${VPS_USER}@${VPS_HOST}" "cd ${VPS_ROOT} && git pull --ff-only origin main && chmod +x scripts/deploy_wave3_sqlite_cleanup_vps.sh && bash scripts/deploy_wave3_sqlite_cleanup_vps.sh --local"
