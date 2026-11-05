#!/usr/bin/env bash
# Run AM W4 Playwright e2e on VPS against production ops URL.
#
# Usage (on VPS):
#   cd /var/www/rnosai && bash scripts/run_am_e2e_vps.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

if [[ -f "$ROOT/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/.env"
  set +a
fi

export OPS_E2E_STAFF_EMAIL="${OPS_E2E_STAFF_EMAIL:-${ADMIN_EMAIL:-admin@pttads.vn}}"
export OPS_E2E_STAFF_PASSWORD="${OPS_E2E_STAFF_PASSWORD:-${ADMIN_PASSWORD:?Set ADMIN_PASSWORD in .env}}"
export OPS_E2E_URL="${OPS_E2E_URL:-https://rs.pttads.vn}"
export OPS_E2E_API_URL="${OPS_E2E_API_URL:-https://rs.pttads.vn}"
export OPS_E2E_SKIP_SERVER=1

cd "$ROOT/services/ops-web"
echo "== AM W4 e2e @ $(git -C "$ROOT" rev-parse --short HEAD 2>/dev/null || echo local) =="
echo "    staff=${OPS_E2E_STAFF_EMAIL} url=${OPS_E2E_URL} api=${OPS_E2E_API_URL}"

npm run test:e2e:am-w4 -- --output=/tmp/rnosai-am-w4-test-results --retries=1 --reporter=list
echo "OK  AM W4 e2e passed"
