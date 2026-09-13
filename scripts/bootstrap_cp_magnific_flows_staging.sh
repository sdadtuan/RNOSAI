#!/usr/bin/env bash
# Post-deploy bootstrap for CP Magnific Flows (Wave B+) on staging VPS.
# See docs/runbooks/cp-magnific-flows.md §3–6.
#
# Prerequisites (human):
#   1. Publish Flow in Magnific Spaces → real sqid
#   2. MAGNIFIC_REST_KEY saved via Settings → Integrations (needs PTT_SECRET_ENCRYPT_KEY)
#
# Usage on VPS:
#   cd /var/www/rnosai
#   FLOW_SQID='your_sqid' bash scripts/bootstrap_cp_magnific_flows_staging.sh
#
# Enable Flow flag after seed + REST key configured:
#   FLOW_SQID='your_sqid' ENABLE_FLOWS=1 bash scripts/bootstrap_cp_magnific_flows_staging.sh
#
# Dry-run (print actions only):
#   DRY_RUN=1 FLOW_SQID='your_sqid' bash scripts/bootstrap_cp_magnific_flows_staging.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="${ENV_FILE:-$ROOT/.env}"
SEED_SQL="$ROOT/scripts/seed_cp_magnific_flow_templates_staging.sql"
DRY_RUN="${DRY_RUN:-0}"
ENABLE_FLOWS="${ENABLE_FLOWS:-0}"
FLOW_SQID="${FLOW_SQID:-}"

run() {
  if [[ "$DRY_RUN" == "1" ]]; then
    echo "[dry-run] $*"
  else
    "$@"
  fi
}

ensure_env_line() {
  local key="$1"
  local value="$2"
  if [[ ! -f "$ENV_FILE" ]]; then
    echo "FAIL  missing $ENV_FILE" >&2
    exit 1
  fi
  if grep -q "^${key}=" "$ENV_FILE" 2>/dev/null; then
    echo "OK    $key already in .env"
  else
    echo "ADD   $key=$value"
    if [[ "$DRY_RUN" != "1" ]]; then
      printf '\n# CP Magnific Flows (Wave B+)\n%s=%s\n' "$key" "$value" >> "$ENV_FILE"
    fi
  fi
}

echo "== CP Magnific Flows bootstrap @ $(git -C "$ROOT" rev-parse --short HEAD 2>/dev/null || echo '?') =="

if [[ -f "$ENV_FILE" ]] && [[ "$DRY_RUN" != "1" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

# Flow tuning defaults (safe with FLOWS_ENABLED=0)
ensure_env_line "MAGNIFIC_FLOW_CACHE_TTL_SEC" "900"
ensure_env_line "MAGNIFIC_FLOW_WAIT_MS" "300000"
ensure_env_line "MAGNIFIC_FLOW_POLL_MS" "4000"
ensure_env_line "MAGNIFIC_FLOW_BATCH_MAX" "20"

if ! grep -q "^PTT_SECRET_ENCRYPT_KEY=" "$ENV_FILE" 2>/dev/null; then
  echo "WARN  PTT_SECRET_ENCRYPT_KEY missing — required to save Magnific REST key in UI." >&2
  echo "      Generate once: openssl rand -base64 24 | head -c 32" >&2
  echo "      Append to .env, restart ptt-crm-api, then Settings → Integrations." >&2
fi

if [[ -z "$FLOW_SQID" ]]; then
  echo ""
  echo "SKIP  seed — set FLOW_SQID to apply template social_916_i2v."
  echo "      List flows: MAGNIFIC_REST_KEY='...' bash scripts/verify_cp_magnific_flow_sqid.sh"
  exit 0
fi

if [[ "$FLOW_SQID" == "REPLACE_WITH_SQID" ]] || [[ "$FLOW_SQID" == "YOUR_FLOW_ID_HERE" ]]; then
  echo "FAIL  FLOW_SQID is still a placeholder." >&2
  exit 1
fi

URL="${DATABASE_URL:-}"
if [[ -z "$URL" ]]; then
  echo "FAIL  DATABASE_URL required in .env" >&2
  exit 1
fi

TMP_SEED="$(mktemp)"
trap 'rm -f "$TMP_SEED"' EXIT
sed "s/REPLACE_WITH_SQID/${FLOW_SQID}/g" "$SEED_SQL" > "$TMP_SEED"

echo "== apply seed (flow_sqid=${FLOW_SQID}) =="
if [[ "$DRY_RUN" == "1" ]]; then
  echo "[dry-run] psql ... -f $TMP_SEED"
else
  psql "$URL" -v ON_ERROR_STOP=1 -f "$TMP_SEED"
  psql "$URL" -c "
    SELECT t.name, m.external_ref AS flow_sqid, m.active
      FROM crm_cp_templates t
      JOIN crm_cp_provider_template_map m ON m.template_id = t.id
     WHERE m.provider = 'magnific_rest'
       AND m.bindings_json->>'execution_kind' = 'flow';"
fi

if [[ "$ENABLE_FLOWS" == "1" ]]; then
  ensure_env_line "MAGNIFIC_FLOWS_ENABLED" "1"
  if ! grep -q "^MAGNIFIC_REST_API_ENABLED=1" "$ENV_FILE" 2>/dev/null; then
    ensure_env_line "MAGNIFIC_REST_API_ENABLED" "1"
  fi
  echo "== restart services =="
  if command -v systemctl >/dev/null 2>&1; then
    run sudo /usr/bin/systemctl restart ptt-crm-api
    run sudo /usr/bin/systemctl restart ptt-ops-web
    if [[ "$DRY_RUN" != "1" ]]; then
      sleep 3
      systemctl is-active ptt-crm-api ptt-ops-web || true
    fi
  fi
  echo "OK    MAGNIFIC_FLOWS_ENABLED=1 — run UAT docs/runbooks/cp-magnific-flows.md §7"
else
  echo ""
  echo "OK    seed applied. MAGNIFIC_FLOWS_ENABLED still off."
  echo "      After REST key + UAT prep: ENABLE_FLOWS=1 bash $0"
fi
