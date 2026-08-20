#!/usr/bin/env bash
# Dual-studio regression — cinematic vd_* vs social CMKT (AC-R1)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
if [[ -f "$ROOT/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/.env"
  set +a
fi

if [[ "${PTT_CMKT_VIDEO_CINEMATIC:-0}" != "1" ]]; then
  echo "SKIP cinematic off"
  exit 0
fi

API_BASE="${PTT_API_URL:-http://127.0.0.1:3000}"
LIFECYCLE_ID="${LIFECYCLE_ID:-3}"
TOKEN="${STAFF_JWT:-${CRM_STAFF_TOKEN:-}}"
INTERNAL_KEY="${PTT_CRM_INTERNAL_KEY:-}"
EMAIL="${ADMIN_EMAIL:-${OPS_E2E_STAFF_EMAIL:-admin@pttads.vn}}"
PASS="${ADMIN_PASSWORD:-${OPS_E2E_STAFF_PASSWORD:-}}"

AUTH=()
if [[ -n "$INTERNAL_KEY" ]]; then
  AUTH=(-H "x-ptt-internal-key: $INTERNAL_KEY")
elif [[ -z "$TOKEN" && -n "$PASS" ]]; then
  TOKEN="$(
    curl -sf "$API_BASE/api/v1/staff/auth/login" \
      -H 'Content-Type: application/json' \
      -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}" \
    | python3 -c "import sys,json; print(json.load(sys.stdin).get('access_token',''))" 2>/dev/null || true
  )"
fi
if [[ -n "$TOKEN" && ${#AUTH[@]} -eq 0 ]]; then
  AUTH=(-H "Authorization: Bearer $TOKEN")
fi
if [[ ${#AUTH[@]} -eq 0 ]]; then
  echo "Set STAFF_JWT, ADMIN_PASSWORD, or PTT_CRM_INTERNAL_KEY"
  exit 1
fi

BASE="$API_BASE/api/crm/service-lifecycle/$LIFECYCLE_ID/content-marketing"
echo "==> Video SOP dual-studio smoke lifecycle #$LIFECYCLE_ID"

ITEM_JSON="$(curl -sf "${AUTH[@]}" -H 'Content-Type: application/json' \
  -d '{"title":"Dual studio cinematic","channel":"short_video","format":"video_script","body_json":{"markdown":"Dual smoke"}}' \
  -X POST "$BASE/items")"
ITEM_ID="$(echo "$ITEM_JSON" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")"
curl -sf "${AUTH[@]}" -X POST "$BASE/items/$ITEM_ID/submit-review" >/dev/null
curl -sf "${AUTH[@]}" -X POST "$BASE/items/$ITEM_ID/approve" >/dev/null
curl -sf "${AUTH[@]}" -H 'Content-Type: application/json' \
  -d "{\"lifecycle_id\":$LIFECYCLE_ID,\"cmkt_item_id\":$ITEM_ID}" \
  -X POST "$API_BASE/api/v1/vd/projects" >/dev/null || true
curl -sf "${AUTH[@]}" -H 'Content-Type: application/json' \
  -d '{"studio":"cinematic"}' \
  -X POST "$BASE/items/$ITEM_ID/video/lock-studio" >/dev/null || true

STORY_BODY="/tmp/vd-dual-storyboard.json"
STORY_CODE="$(
  curl -sS -o "$STORY_BODY" -w '%{http_code}' "${AUTH[@]}" \
    -H 'Content-Type: application/json' \
    -d '{"pack_default":"reels"}' \
    -X POST "$BASE/items/$ITEM_ID/jobs/video-storyboard"
)"
if [[ "$STORY_CODE" != "400" ]]; then
  echo "FAIL cinematic storyboard expected 400 studio_mismatch got $STORY_CODE"
  cat "$STORY_BODY" >&2 || true
  exit 1
fi
if ! grep -Eq 'studio_locked|studio_mismatch' "$STORY_BODY"; then
  echo "FAIL missing studio_mismatch in body"
  exit 1
fi

URL="${DATABASE_URL:-}"
if [[ -n "$URL" ]]; then
  SOCIAL_COUNT="$(
    psql "$URL" -Atqc "SELECT COUNT(*) FROM vd_jobs WHERE job_type LIKE 'social_%';" 2>/dev/null || echo 0
  )"
  if [[ "${SOCIAL_COUNT:-0}" != "0" ]]; then
    echo "FAIL vd_jobs contains social_* rows: $SOCIAL_COUNT"
    exit 1
  fi
else
  echo "WARN skip vd_jobs SQL check (no DATABASE_URL)"
fi

echo "OK dual studio — cinematic blocks social_storyboard on locked item"
