#!/usr/bin/env bash
# Rebuild portal-web on VPS (deploy user — no systemctl).
# After this: sudo systemctl restart ptt-portal-web
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PORTAL_API_URL="${NEXT_PUBLIC_PTT_API_URL:-https://portal.pttads.vn}"
PWA_ENABLED="${NEXT_PUBLIC_PWA_ENABLED:-1}"
# shellcheck source=lib/portal_web_standalone.sh
. "$ROOT/scripts/lib/portal_web_standalone.sh"

cd "$ROOT/services/portal-web"
echo "== Rebuild portal-web (deploy) =="
echo "NEXT_PUBLIC_PTT_API_URL=$PORTAL_API_URL"
echo "NEXT_PUBLIC_PWA_ENABLED=$PWA_ENABLED"
git -C "$ROOT" log -1 --oneline 2>/dev/null || true

python3 "$ROOT/scripts/generate_portal_pwa_icons.py"

npm ci
export NEXT_PUBLIC_PTT_API_URL="$PORTAL_API_URL"
export NEXT_PUBLIC_PWA_ENABLED="$PWA_ENABLED"
npm run build
portal_web_sync_static

echo ""
echo "Next: sudo systemctl restart ptt-portal-web"
