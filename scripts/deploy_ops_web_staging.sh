#!/usr/bin/env bash
# Staging ops-web only — https://rs.pttads.vn/test (never touches current/ops-web prod).
#
#   cd /var/www/rnosai && ./scripts/deploy_ops_web_staging.sh --all
#   sudo ./scripts/deploy_ops_web_staging.sh --restart
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export RNOSAI_ROOT="$ROOT"
# shellcheck source=lib/ops_web_staging.sh
. "$ROOT/scripts/lib/ops_web_staging.sh"

MODE="${1:-build}"
export NEXT_PUBLIC_PTT_API_URL="${NEXT_PUBLIC_PTT_API_URL:-https://rs.pttads.vn}"
export NEXT_PUBLIC_BASE_PATH="${NEXT_PUBLIC_BASE_PATH:-/test}"

do_build=0
do_restart=0

case "$MODE" in
  build) do_build=1 ;;
  --restart) do_restart=1 ;;
  --all) do_build=1; do_restart=1 ;;
  *)
    echo "Usage: $0 [build|--restart|--all]"
    exit 1
    ;;
esac

if [[ "$do_build" == "1" ]]; then
  ops_web_staging_build
  ops_web_publish_staging_release >/dev/null
  echo ""
  echo "Staging build OK. Restart: sudo $0 --restart"
fi

if [[ "$do_restart" == "1" ]]; then
  if [[ "$(id -u)" -ne 0 ]]; then
    echo "FAIL  --restart requires sudo"
    exit 1
  fi
  cp "$ROOT/deploy/ptt-ops-web-staging.service" /etc/systemd/system/ptt-ops-web-staging.service
  systemctl daemon-reload
  systemctl enable ptt-ops-web-staging
  systemctl restart ptt-ops-web-staging
  sleep 2
  systemctl is-active ptt-ops-web-staging
  ops_web_staging_verify_local || true
fi

echo ""
echo "Staging URL: https://rs.pttads.vn/test/crm/leads (same API/DB as prod — test carefully)."
