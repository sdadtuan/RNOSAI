#!/usr/bin/env bash
# Deploy Quotation OS Wave 1–3 — DDL + catalog + ptt-crm-api + ops-web + portal-web.
# Do NOT export QT_AI_ENABLED=1 — AI stays off until UAT signoff is green.
# Do NOT grant crm_quote caps here — seed_qt_rbac.sh is catalog-only.
#
# From laptop:
#   APPLY=1 ./scripts/deploy_quotation_os_vps.sh
#
# On VPS:
#   cd /var/www/rnosai && git pull --ff-only origin main && bash scripts/deploy_quotation_os_vps.sh --local
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VPS_HOST="${PTT_VPS_HOST:-rs.pttads.vn}"
VPS_USER="${PTT_VPS_USER:-deploy}"
VPS_ROOT="${PTT_VPS_ROOT:-/var/www/rnosai}"
APPLY="${APPLY:-0}"

run_local() {
  echo "== Quotation OS Wave 1–3 deploy @ $(git -C "$ROOT" rev-parse --short HEAD) =="
  cd "$ROOT"

  if [[ -f "$ROOT/.env" ]]; then
    set -a
    # shellcheck disable=SC1091
    source "$ROOT/.env"
    set +a
  fi

  echo "== 0/8 apply QT Wave 1 DDL =="
  bash "$ROOT/scripts/apply_pg_ddl_qt.sh"

  echo "== 1/8 apply QT Wave 2 DDL =="
  bash "$ROOT/scripts/apply_pg_ddl_qt_w2.sh"

  echo "== 2/8 apply QT Wave 3 DDL =="
  bash "$ROOT/scripts/apply_pg_ddl_qt_w3.sh"

  echo "== 2b/8 apply lead-party DDL =="
  bash "$ROOT/scripts/apply_pg_ddl_lead_party.sh"

  echo "== 2c/8 apply QT catalog admin DDL =="
  bash "$ROOT/scripts/apply_pg_ddl_qt_catalog_admin.sh"

  echo "== 3/8 QT RBAC catalog (no user grants) =="
  bash "$ROOT/scripts/seed_qt_rbac.sh"

  echo "== 3b/8 QT rate/cost seed (package DVs + DV19) =="
  bash "$ROOT/scripts/seed_qt_rate_cost.sh"

  echo "== 4/8 ptt-crm-api build + QT unit tests =="
  cd "$ROOT/services/ptt-crm-api"
  npm ci
  export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=2048}"
  npm run build
  npx jest --config jest.config.js src/proposals --forceExit --no-coverage
  node --test "$ROOT/scripts/lib/qt-rate-cost-seed.spec.js"

  echo "== 5/8 ops-web QT unit tests =="
  cd "$ROOT/services/ops-web"
  npm ci
  npx vitest run src/components/crm/qt src/components/crm/LeadPartyCard.spec.ts src/lib/crm/qt-*.spec.ts src/lib/crm/lead-party.util.spec.ts src/lib/auth.spec.ts

  echo "== 6/8 ops-web build =="
  cd "$ROOT"
  export NEXT_PUBLIC_PTT_API_URL="${NEXT_PUBLIC_PTT_API_URL:-https://rs.pttads.vn}"
  "$ROOT/scripts/deploy_ops_web.sh" build

  echo "== 7/8 portal-web rebuild (public quote accept + OTP) =="
  bash "$ROOT/scripts/wave_b2_rebuild_portal_web.sh"

  echo "== 8/8 restart services (one unit per command) =="
  if command -v systemctl >/dev/null 2>&1; then
    restarted=0
    for unit in ptt-crm-api ptt-ops-web ptt-portal-web; do
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
      systemctl is-active ptt-portal-web || true
    else
      echo "      Run: sudo /usr/bin/systemctl restart ptt-crm-api"
      echo "           sudo /usr/bin/systemctl restart ptt-ops-web"
      echo "           sudo /usr/bin/systemctl restart ptt-portal-web"
    fi
  fi

  echo "OK  Quotation OS Wave 1–3 deployed (QT_AI_ENABLED not enabled; grant crm_quote via Admin RBAC)"
}

if [[ "${1:-}" == "--local" ]]; then
  run_local
  exit 0
fi

if [[ "$APPLY" != "1" ]]; then
  echo "Dry run. Set APPLY=1 to deploy to $VPS_USER@$VPS_HOST:$VPS_ROOT"
  exit 0
fi

ssh "$VPS_USER@$VPS_HOST" "cd '$VPS_ROOT' && git pull --ff-only origin main && bash scripts/deploy_quotation_os_vps.sh --local"
