#!/usr/bin/env bash
# MSOS W1+WIN pilot — enable flags + build on staging VPS (rs.pttads.vn)
#
# From laptop:
#   APPLY=1 ./scripts/deploy_msos_pilot_staging.sh
#
# On VPS directly:
#   cd /var/www/rnosai && bash scripts/deploy_msos_pilot_staging.sh --local
#
# Disable pilot:
#   MSOS_PILOT=0 bash scripts/deploy_msos_pilot_staging.sh --local
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VPS_HOST="${PTT_VPS_HOST:-rs.pttads.vn}"
VPS_USER="${PTT_VPS_USER:-deploy}"
VPS_ROOT="${PTT_VPS_ROOT:-/var/www/rnosai}"
APPLY="${APPLY:-0}"
MSOS_PILOT="${MSOS_PILOT:-1}"

run_local() {
  cd "$ROOT"
  echo "== MSOS pilot staging @ $(git rev-parse --short HEAD 2>/dev/null || echo unknown) =="
  echo "    MSOS_PILOT=$MSOS_PILOT"

  if [[ -f "$ROOT/.env" ]]; then
    set -a
    # shellcheck disable=SC1091
    source "$ROOT/.env"
    set +a
  fi

  RUNTIME_ENV="$ROOT/deploy/runtime.env"
  mkdir -p "$ROOT/deploy"
  touch "$RUNTIME_ENV"

  if [[ "$MSOS_PILOT" == "1" ]]; then
    for kv in \
      "PTT_MEDIA_OS_ENABLED=1" \
      "NEXT_PUBLIC_MEDIA_OS=1"; do
      key="${kv%%=*}"
      if grep -q "^${key}=" "$RUNTIME_ENV" 2>/dev/null; then
        sed -i.bak "s|^${key}=.*|${kv}|" "$RUNTIME_ENV"
      else
        echo "$kv" >>"$RUNTIME_ENV"
      fi
    done
  else
    for kv in \
      "PTT_MEDIA_OS_ENABLED=0" \
      "NEXT_PUBLIC_MEDIA_OS=0"; do
      key="${kv%%=*}"
      if grep -q "^${key}=" "$RUNTIME_ENV" 2>/dev/null; then
        sed -i.bak "s|^${key}=.*|${kv}|" "$RUNTIME_ENV"
      else
        echo "$kv" >>"$RUNTIME_ENV"
      fi
    done
  fi
  echo "Updated $RUNTIME_ENV"

  echo "== Build ptt-crm-api =="
  if [[ -d "$ROOT/services/ptt-crm-api" ]]; then
    (cd "$ROOT/services/ptt-crm-api" && npm ci && npm run build && npx jest src/msos/ --forceExit --no-coverage)
  fi

  echo "== Build ops-web =="
  export NEXT_PUBLIC_PTT_API_URL="${NEXT_PUBLIC_PTT_API_URL:-https://rs.pttads.vn}"
  if [[ "$MSOS_PILOT" == "1" ]]; then
    NEXT_PUBLIC_MEDIA_OS=1 bash "$ROOT/scripts/deploy_ops_web.sh" build
  else
    NEXT_PUBLIC_MEDIA_OS=0 bash "$ROOT/scripts/deploy_ops_web.sh" build
  fi
  (cd "$ROOT/services/ops-web" && npx vitest run src/lib/crm/msos)

  if sudo -n /usr/bin/systemctl restart ptt-crm-api 2>/dev/null; then
    sudo -n /usr/bin/systemctl restart ptt-ops-web 2>/dev/null || true
    sleep 3
    curl -sf http://127.0.0.1:3000/health && echo " Nest OK"
  else
    echo "SKIP systemd restart — run:"
    echo "  sudo /usr/bin/systemctl restart ptt-crm-api ptt-ops-web"
  fi

  if [[ "$MSOS_PILOT" == "1" ]]; then
    echo "== Smoke (optional: set STAFF_TOKEN or ADMIN_PASSWORD) =="
    bash "$ROOT/scripts/smoke_msos_pilot.sh" || echo "WARN smoke failed — grant crm_media via MSOS-PILOT permission set"
  fi

  echo "== MSOS pilot staging complete (MSOS_PILOT=$MSOS_PILOT) =="
  echo "Grant: Admin → Permission Sets → MSOS-PILOT → assign staff"
  echo "UAT: /crm/media-os — partner → inventory → placement → package → reserve → IO → campaigns"
}

if [[ "${1:-}" == "--local" ]]; then
  run_local
elif [[ "$APPLY" == "1" ]]; then
  echo "== SSH ${VPS_USER}@${VPS_HOST}:${VPS_ROOT} =="
  ssh "${VPS_USER}@${VPS_HOST}" "cd ${VPS_ROOT} && git pull --ff-only origin main && MSOS_PILOT=${MSOS_PILOT} bash scripts/deploy_msos_pilot_staging.sh --local"
else
  echo "Dry-run. Set APPLY=1 to run on ${VPS_USER}@${VPS_HOST}:${VPS_ROOT}"
  echo "Disable: MSOS_PILOT=0 APPLY=1 $0"
fi
