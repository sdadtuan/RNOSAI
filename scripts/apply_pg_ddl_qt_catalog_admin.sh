#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
if [[ -f "$ROOT/.env" ]]; then set -a; source "$ROOT/.env"; set +a; fi
URL="${DATABASE_URL:-}"
if [[ -z "$URL" ]]; then echo "Set DATABASE_URL in .env" >&2; exit 1; fi
psql "$URL" -v ON_ERROR_STOP=1 -f "$ROOT/docs/specs/2026-09-09-postgresql-ddl-qt-catalog-admin.sql"
echo "OK  QT catalog admin DDL applied (groups + service group_key)"
