#!/usr/bin/env bash
# RNOS-01 — Revenue OS + AI Intelligence PostgreSQL DDL
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DDL="$ROOT/docs/specs/2026-07-26-postgresql-ddl-revenue-os-ai.sql"
: "${DATABASE_URL:?DATABASE_URL required}"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$DDL"
echo "Applied Revenue OS AI DDL (2026-07-26-revenue-os-ai)"
