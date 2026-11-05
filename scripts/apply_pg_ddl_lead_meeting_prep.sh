#!/usr/bin/env bash
# Apply Lead Meeting Prep (SCI) PostgreSQL DDL — S-LMP-1
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

DDL="$ROOT/docs/specs/2026-08-13-postgresql-ddl-lead-meeting-prep.sql"
MIGRATION="$ROOT/docs/specs/2026-08-28-lmp-awaiting-am-input-migration.sql"
echo "Applying Lead Meeting Prep DDL..."
psql "$URL" -v ON_ERROR_STOP=1 -f "$DDL"
if [[ -f "$MIGRATION" ]]; then
  echo "Applying LMP Phase 0 migration (awaiting_am_input)..."
  psql "$URL" -v ON_ERROR_STOP=1 -f "$MIGRATION"
fi
echo "OK  crm_lead_meeting_prep DDL applied"
