#!/usr/bin/env bash
# Deploy PTT Facebook Lead video pack (QC utils + docs). No DDL.
#
# From laptop:
#   APPLY=1 ./scripts/deploy_ptt_fb_lead_video_vps.sh
#
# On VPS:
#   cd /var/www/rnosai && git pull --ff-only origin main && bash scripts/deploy_ptt_fb_lead_video_vps.sh --local
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VPS_HOST="${PTT_VPS_HOST:-rs.pttads.vn}"
VPS_USER="${PTT_VPS_USER:-deploy}"
VPS_ROOT="${PTT_VPS_ROOT:-/var/www/rnosai}"
APPLY="${APPLY:-0}"

run_local() {
  cd "$ROOT"
  echo "== PTT FB Lead video deploy @ $(git rev-parse --short HEAD) =="

  echo "== 1/2 ptt-crm-api build + pack tests =="
  cd "$ROOT/services/ptt-crm-api"
  npm ci
  export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=2048}"
  npm run build
  npx jest --config jest.config.js \
    src/cp/ptt-fb-lead-video-qc.util.spec.ts \
    src/cp/ptt-fb-lead-video-qc.pack.optional.spec.ts \
    src/webhooks/ptt-fb-lead-form.util.spec.ts \
    --forceExit --no-coverage

  echo "== 2/2 restart ptt-crm-api =="
  if command -v systemctl >/dev/null 2>&1; then
    if sudo -n /usr/bin/systemctl restart ptt-crm-api 2>/dev/null; then
      echo "OK  restarted ptt-crm-api"
    else
      echo "WARN  sudo restart failed for ptt-crm-api"
    fi
    sleep 3
    systemctl is-active ptt-crm-api
  fi

  echo "OK  PTT FB Lead video repo wave deployed (docs + QC utils). Ads/form ops stay manual."
}

if [[ "${1:-}" == "--local" ]]; then
  run_local
  exit 0
fi

if [[ "$APPLY" != "1" ]]; then
  echo "Dry run. Set APPLY=1 to deploy to $VPS_USER@$VPS_HOST:$VPS_ROOT"
  exit 0
fi

ssh "$VPS_USER@$VPS_HOST" "cd '$VPS_ROOT' && git pull --ff-only origin main && bash scripts/deploy_ptt_fb_lead_video_vps.sh --local"
