#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
if [[ -f "$ROOT/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/.env"
  set +a
fi
: "${DATABASE_URL:?DATABASE_URL required}"
echo "==> Apply VN admin geo DDL"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$ROOT/docs/specs/postgresql-ddl-vn-admin-geo.sql"
echo "OK  vn_provinces / vn_wards DDL applied"
