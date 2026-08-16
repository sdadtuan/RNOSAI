#!/usr/bin/env bash
# One-time (or re-run safe): install postgresql-*-pgvector on Debian/Ubuntu VPS,
# enable CREATE EXTENSION vector, then apply Market Research P20 DDL.
#
# Usage (on VPS as deploy or root with sudo):
#   cd /var/www/rnosai && bash scripts/install_pgvector_vps.sh
#
# Requires: apt, psql, DATABASE_URL or default dev URL.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export DATABASE_URL="${DATABASE_URL:-postgresql://ptt:ptt_dev@127.0.0.1:5433/rnosaidb}"

if [[ -f "$ROOT/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/.env"
  set +a
fi

detect_pg_major() {
  if command -v psql >/dev/null 2>&1; then
    psql --version | sed -nE 's/.* ([0-9]+)\.*/\1/p' | head -1
    return
  fi
  if command -v pg_config >/dev/null 2>&1; then
    pg_config --version | sed -nE 's/.* ([0-9]+)\.*/\1/p' | head -1
    return
  fi
  echo ""
}

PG_MAJOR="${PG_MAJOR:-$(detect_pg_major)}"
if [[ -z "$PG_MAJOR" ]]; then
  echo "FAIL  cannot detect PostgreSQL major version (set PG_MAJOR=15 manually)"
  exit 1
fi

PKG="postgresql-${PG_MAJOR}-pgvector"
echo "==> Install ${PKG} (PG ${PG_MAJOR})"
if command -v apt-get >/dev/null 2>&1; then
  sudo apt-get update -qq
  sudo apt-get install -y "$PKG"
else
  echo "FAIL  apt-get not found — install ${PKG} manually"
  exit 1
fi

echo "==> CREATE EXTENSION vector"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "CREATE EXTENSION IF NOT EXISTS vector"

echo "==> Apply Market Research P20 DDL"
bash "$ROOT/scripts/apply_pg_ddl_market_research_p20.sh"

echo "==> Verify pgvector readiness"
bash "$ROOT/scripts/verify_pgvector_market_research.sh"

echo "OK  pgvector installed and Market Research P20 schema ready"
