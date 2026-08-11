#!/usr/bin/env bash
# Apply Sprint 0 Deal Room F4 PG DDL (crm_proposals lead_id / presales_id).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ -f "$ROOT/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/.env"
  set +a
fi

URL="${DATABASE_URL:-}"
if [[ -z "$URL" ]]; then
  echo "Set DATABASE_URL in .env" >&2
  exit 1
fi

DDL="$ROOT/docs/specs/2026-08-11-deal-room-s0-proposals-ddl.sql"
echo "Applying Deal Room S0 proposals DDL..."
psql "$URL" -v ON_ERROR_STOP=1 -f "$DDL"
echo "OK  Deal Room S0 proposals PG DDL applied"
