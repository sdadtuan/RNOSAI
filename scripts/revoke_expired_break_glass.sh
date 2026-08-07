#!/usr/bin/env bash
# Revoke expired break-glass grants (TTL 24h). Cron: hourly on VPS.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export DATABASE_URL="${DATABASE_URL:-postgresql://ptt:ptt_dev@127.0.0.1:5433/rnosaidb}"

if ! command -v psql >/dev/null 2>&1; then
  echo "FAIL psql required for revoke_expired_break_glass" >&2
  exit 1
fi

echo "==> Revoke expired break-glass grants"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
UPDATE staff_break_glass_grants
SET status = 'expired',
    revoked_at = NOW(),
    revoked_by = 'cron:revoke_expired_break_glass'
WHERE status = 'approved'
  AND revoked_at IS NULL
  AND expires_at IS NOT NULL
  AND expires_at <= NOW();
SQL

echo "OK  expired break-glass grants revoked"
