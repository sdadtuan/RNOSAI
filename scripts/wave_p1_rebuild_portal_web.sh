#!/usr/bin/env bash
# Rebuild portal-web (P1 shell deploy — deploy user, no systemctl).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OPS_API_URL="${NEXT_PUBLIC_PTT_API_URL:-https://rs.pttads.vn}"
# shellcheck source=lib/portal_web_standalone.sh
. "$ROOT/scripts/lib/portal_web_standalone.sh"

cd "$ROOT/services/portal-web"
echo "== Rebuild portal-web (P1) =="
echo "NEXT_PUBLIC_PTT_API_URL=$OPS_API_URL"
git -C "$ROOT" log -1 --oneline

npm ci
export NEXT_PUBLIC_PTT_API_URL="$OPS_API_URL"
npm run build
portal_web_sync_static

echo ""
echo "Next: sudo systemctl restart ptt-portal-web"
