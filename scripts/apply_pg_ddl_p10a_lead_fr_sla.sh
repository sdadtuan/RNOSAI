#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
URL="${DATABASE_URL:-}"
if [[ -z "$URL" && -f "$ROOT/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/.env"
  set +a
  URL="${DATABASE_URL:-}"
fi
[[ -n "$URL" ]] || { echo "Set DATABASE_URL" >&2; exit 1; }
psql "$URL" -v ON_ERROR_STOP=1 -f "$ROOT/docs/specs/2026-09-22-postgresql-ddl-p10a-lead-fr-sla.sql"
echo "OK  P10.a lead-fr-sla DDL applied"
