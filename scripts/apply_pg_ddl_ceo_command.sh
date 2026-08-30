#!/usr/bin/env bash
# Apply CEO Command PostgreSQL DDL — turns / actions / learn
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

DDL="$ROOT/docs/specs/2026-08-30-ceo-command-ddl.sql"
echo "Applying CEO Command DDL..."
psql "$URL" -v ON_ERROR_STOP=1 -f "$DDL"
echo "OK  ceo_command DDL applied"
