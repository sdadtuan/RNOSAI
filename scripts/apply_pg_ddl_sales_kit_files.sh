#!/usr/bin/env bash
# Apply Sales Kit Files PostgreSQL DDL — Intake S4
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

DDL="$ROOT/docs/specs/2026-08-29-sales-kit-files-ddl.sql"
echo "Applying Sales Kit Files DDL..."
psql "$URL" -v ON_ERROR_STOP=1 -f "$DDL"
echo "OK  sales_kit_files DDL applied"
