#!/usr/bin/env bash
# Run RevOps Playwright e2e on VPS against production ops URL.
#
# Usage (on VPS):
#   cd /var/www/rnosai && bash scripts/run_revops_e2e_vps.sh
#   cd /var/www/rnosai && bash scripts/run_revops_e2e_vps.sh --full
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FULL=0
for arg in "$@"; do
  case "$arg" in
    --full) FULL=1 ;;
  esac
done

if [[ -f "$ROOT/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/.env"
  set +a
fi

export OPS_E2E_STAFF_EMAIL="${OPS_E2E_STAFF_EMAIL:-${ADMIN_EMAIL:-admin@pttads.vn}}"
export OPS_E2E_STAFF_PASSWORD="${OPS_E2E_STAFF_PASSWORD:-${ADMIN_PASSWORD:?Set ADMIN_PASSWORD in .env}}"
# Use public ops URL so browser API calls are same-origin (localhost is not in PTT_OPS_CORS_ORIGINS).
export OPS_E2E_URL="${OPS_E2E_URL:-https://rs.pttads.vn}"
export OPS_E2E_API_URL="${OPS_E2E_API_URL:-https://rs.pttads.vn}"
export OPS_E2E_SKIP_SERVER=1
export NEXT_PUBLIC_PTT_API_URL="${NEXT_PUBLIC_PTT_API_URL:-$OPS_E2E_API_URL}"
export NEXT_PUBLIC_REVOPS_SHELL=1
export NEXT_PUBLIC_LEAD_PIPELINE_TAB=1
export NEXT_PUBLIC_REVOPS_ROUTE_CATALOG="${NEXT_PUBLIC_REVOPS_ROUTE_CATALOG:-0}"

cd "$ROOT/services/ops-web"
echo "== RevOps e2e @ $(git -C "$ROOT" rev-parse --short HEAD 2>/dev/null || echo local) =="
echo "    staff=${OPS_E2E_STAFF_EMAIL} url=${OPS_E2E_URL} api=${OPS_E2E_API_URL}"

E2E_FAIL=0
npm run test:e2e:revops-w3 || E2E_FAIL=1
if [[ "$FULL" == "1" ]]; then
  npm run test:e2e:revops-full || E2E_FAIL=1
fi

if [[ "$E2E_FAIL" != "0" ]]; then
  echo "WARN  RevOps e2e had failures (see report above)"
  exit 1
fi

echo "OK  RevOps e2e passed"
