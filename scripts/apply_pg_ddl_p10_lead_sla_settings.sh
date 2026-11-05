#!/usr/bin/env bash
# Apply P10 Lead SLA Admin DDL (crm_lead_sla_settings + revisions + FR cols + accepts seed).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
URL="${DATABASE_URL:-}"
if [[ -z "$URL" ]]; then
  if [[ -f "$ROOT/.env" ]]; then
    set -a
    # shellcheck disable=SC1091
    source "$ROOT/.env"
    set +a
    URL="${DATABASE_URL:-}"
  fi
fi
if [[ -z "$URL" ]]; then
  echo "Set DATABASE_URL" >&2
  exit 1
fi
psql "$URL" -v ON_ERROR_STOP=1 -f "$ROOT/docs/specs/2026-09-22-postgresql-ddl-p10-lead-sla-settings.sql"
echo "OK  P10 lead-sla-settings DDL applied"
