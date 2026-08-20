#!/usr/bin/env bash
# Smoke — Video SOP S5: Gate 1–2 + AC-R3 stage guard
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

echo "==> Video SOP S5 smoke lifecycle #$LIFECYCLE_ID"

LIST_BODY="/tmp/vd-sop-s5-projects.json"
LIST_CODE="$(
  curl -sS -o "$LIST_BODY" -w '%{http_code}' "${AUTH[@]}" \
    "$API_BASE/api/v1/vd/projects?lifecycle_id=$LIFECYCLE_ID"
)"
if grep -q 'cmkt_cinematic_disabled' "$LIST_BODY"; then
  echo "SKIP cinematic off"
  exit 0
fi

PROJ_ID=""
if [[ "$LIST_CODE" == "200" ]]; then
  PROJ_ID="$(
    python3 -c "
import json, sys
p = json.load(open(sys.argv[1], encoding='utf-8'))
items = p if isinstance(p, list) else (p.get('items') or [])
ids = [it['id'] for it in items if isinstance(it, dict) and isinstance(it.get('id'), int) and it['id'] > 0]
if ids:
    print(ids[0])
" "$LIST_BODY"
  )"
fi

if [[ -z "$PROJ_ID" ]]; then
  echo "FAIL no reusable project — run smoke_video_sop_s3.sh first"
  exit 1
fi

G1_BODY="/tmp/vd-sop-s5-g1.json"
G1_CODE="$(
  curl -sS -o "$G1_BODY" -w '%{http_code}' "${AUTH[@]}" \
    "$API_BASE/api/v1/vd/projects/$PROJ_ID/gates/1"
)"
if [[ "$G1_CODE" != "200" ]]; then
  echo "FAIL GET /gates/1 HTTP $G1_CODE"
  exit 1
fi

STAGE_BLOCK_BODY="/tmp/vd-sop-s5-stage-block.json"
STAGE_BLOCK_CODE="$(
  curl -sS -o "$STAGE_BLOCK_BODY" -w '%{http_code}' "${AUTH[@]}" \
    -H 'Content-Type: application/json' \
    -d '{"stage":"animating"}' \
    -X POST "$API_BASE/api/v1/vd/projects/$PROJ_ID/stage"
)"
if [[ "$STAGE_BLOCK_CODE" == "200" ]]; then
  echo "FAIL POST /stage animating should be blocked (AC-R3) before gate2 approved"
  exit 1
fi
python3 -c "
import json, sys
p = json.load(open(sys.argv[1], encoding='utf-8'))
err = p.get('error') or p.get('message') or ''
if err != 'stage_guard':
    raise SystemExit(f'FAIL expected stage_guard got={err!r}')
" "$STAGE_BLOCK_BODY"

STYLE_BODY='{"palette":["#000"],"lens":"50mm","lighting":"soft","refs":[]}'
curl -sS -o /dev/null "${AUTH[@]}" \
  -H 'Content-Type: application/json' \
  -d "$STYLE_BODY" \
  -X PUT "$API_BASE/api/v1/vd/projects/$PROJ_ID/bibles/style" || true

CHARS_BODY='{"items":[{"name":"Hero","lock_regions":["face"],"notes":""}]}'
curl -sS -o /dev/null "${AUTH[@]}" \
  -H 'Content-Type: application/json' \
  -d "$CHARS_BODY" \
  -X PUT "$API_BASE/api/v1/vd/projects/$PROJ_ID/bibles/characters" || true

SHOTS_BODY="/tmp/vd-sop-s5-shots.json"
curl -sS -o "$SHOTS_BODY" "${AUTH[@]}" \
  "$API_BASE/api/v1/vd/projects/$PROJ_ID/shots" >/dev/null

SHOT_IDS="$(
  python3 -c "
import json, sys
p = json.load(open(sys.argv[1], encoding='utf-8'))
items = p if isinstance(p, list) else (p.get('items') or [])
ids = [it['id'] for it in items if isinstance(it, dict) and isinstance(it.get('id'), int) and it['id'] > 0]
print(' '.join(str(i) for i in ids))
" "$SHOTS_BODY"
)"

if [[ -z "$SHOT_IDS" ]]; then
  echo "FAIL no shots — run smoke_video_sop_s3.sh first"
  exit 1
fi

G1_APPROVE_BODY="/tmp/vd-sop-s5-g1-approve.json"
G1_APPROVE_CODE="$(
  curl -sS -o "$G1_APPROVE_BODY" -w '%{http_code}' "${AUTH[@]}" \
    -H 'Content-Type: application/json' \
    -d '{}' \
    -X POST "$API_BASE/api/v1/vd/projects/$PROJ_ID/gates/1/approve"
)"
if [[ "$G1_APPROVE_CODE" != "200" ]]; then
  echo "FAIL POST /gates/1/approve HTTP $G1_APPROVE_CODE"
  cat "$G1_APPROVE_BODY" >&2 || true
  exit 1
fi
python3 -c "
import json, sys
p = json.load(open(sys.argv[1], encoding='utf-8'))
if p.get('status') != 'approved':
    raise SystemExit(f'FAIL gate1 status={p.get(\"status\")!r}')
if p.get('stage') != 'keyframing':
    raise SystemExit(f'FAIL expected stage keyframing got={p.get(\"stage\")!r}')
" "$G1_APPROVE_BODY"

SCRIPT_LIST_BODY="/tmp/vd-sop-s5-scripts.json"
curl -sS -o "$SCRIPT_LIST_BODY" "${AUTH[@]}" \
  "$API_BASE/api/v1/vd/projects/$PROJ_ID/scripts" >/dev/null
SCRIPT_ID="$(
  python3 -c "
import json, sys
p = json.load(open(sys.argv[1], encoding='utf-8'))
items = p if isinstance(p, list) else (p.get('items') or [])
ids = [it['id'] for it in items if isinstance(it, dict) and isinstance(it.get('id'), int) and it['id'] > 0]
if ids:
    print(max(ids))
" "$SCRIPT_LIST_BODY"
)"
if [[ -n "$SCRIPT_ID" ]]; then
  IMMUTABLE_BODY="/tmp/vd-sop-s5-shot-immutable.json"
  IMMUTABLE_CODE="$(
    curl -sS -o "$IMMUTABLE_BODY" -w '%{http_code}' "${AUTH[@]}" \
      -H 'Content-Type: application/json' \
      -d '{"duration_ms":3000,"camera":"wide","action":"walk","aspect":"9:16","contains_human":false}' \
      -X POST "$API_BASE/api/v1/vd/scripts/$SCRIPT_ID/shots"
  )"
  if [[ "$IMMUTABLE_CODE" == "201" || "$IMMUTABLE_CODE" == "200" ]]; then
    echo "FAIL POST /shots should be blocked after gate1 approve (BR-04)"
    exit 1
  fi
  python3 -c "
import json, sys
p = json.load(open(sys.argv[1], encoding='utf-8'))
err = p.get('error') or p.get('message') or ''
if err != 'shotlist_immutable':
    raise SystemExit(f'FAIL expected shotlist_immutable got={err!r}')
" "$IMMUTABLE_BODY"
fi

for SHOT_ID in $SHOT_IDS; do
  curl -sS -o /dev/null "${AUTH[@]}" \
    -H 'Content-Type: application/json' \
    -d '{}' \
    -X POST "$API_BASE/api/v1/vd/shots/$SHOT_ID/approve-keyframe" || true
done

G2_APPROVE_BODY="/tmp/vd-sop-s5-g2-approve.json"
G2_APPROVE_CODE="$(
  curl -sS -o "$G2_APPROVE_BODY" -w '%{http_code}' "${AUTH[@]}" \
    -H 'Content-Type: application/json' \
    -d '{}' \
    -X POST "$API_BASE/api/v1/vd/projects/$PROJ_ID/gates/2/approve"
)"
if [[ "$G2_APPROVE_CODE" != "200" ]]; then
  echo "FAIL POST /gates/2/approve HTTP $G2_APPROVE_CODE"
  cat "$G2_APPROVE_BODY" >&2 || true
  exit 1
fi
python3 -c "
import json, sys
p = json.load(open(sys.argv[1], encoding='utf-8'))
if p.get('status') != 'approved':
    raise SystemExit(f'FAIL gate2 status={p.get(\"status\")!r}')
if p.get('stage') != 'animating':
    raise SystemExit(f'FAIL expected stage animating got={p.get(\"stage\")!r}')
" "$G2_APPROVE_BODY"

echo "OK Video SOP S5 — project #$PROJ_ID"
