#!/usr/bin/env bash
# Seed one PG lifecycle for MKT-AI pilot smoke/UAT (staging only).
# Idempotent: reuses row when service_slug=meta-lead-gen and notes tag present.
#
# Usage:
#   export DATABASE_URL=postgresql://ptt:PASS@127.0.0.1:5432/rnosaidb
#   ./scripts/seed_mkt_ai_uat_lifecycle.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
if [[ -f "$ROOT/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/.env"
  set +a
fi

: "${DATABASE_URL:?DATABASE_URL required}"

export MKT_AI_SEED_TAG='mkt-ai-smoke-seed'
export MKT_AI_SEED_SLUG='meta-lead-gen'
export MKT_AI_SEED_STAGE='onboard'

echo "== Seed MKT-AI UAT lifecycle (slug=${MKT_AI_SEED_SLUG}, stage=${MKT_AI_SEED_STAGE}) =="

python3 - <<'PY'
import os
import psycopg2

db = os.environ["DATABASE_URL"]
tag = os.environ["MKT_AI_SEED_TAG"]
slug = os.environ["MKT_AI_SEED_SLUG"]
stage = os.environ["MKT_AI_SEED_STAGE"]

conn = psycopg2.connect(db)
conn.autocommit = False
cur = conn.cursor()
cur.execute(
    """
    SELECT id FROM crm_service_lifecycle
    WHERE service_slug = %s AND notes = %s
    ORDER BY id DESC LIMIT 1
    """,
    (slug, tag),
)
row = cur.fetchone()
if row:
    lifecycle_id = row[0]
    print(f"REUSE lifecycle_id={lifecycle_id}")
else:
    cur.execute(
        """
        INSERT INTO crm_service_lifecycle
            (service_slug, stage, status, notes)
        VALUES (%s, %s, 'active', %s)
        RETURNING id
        """,
        (slug, stage, tag),
    )
    lifecycle_id = cur.fetchone()[0]
    conn.commit()
    print(f"INSERT lifecycle_id={lifecycle_id}")

cur.close()
conn.close()
print(f"OK  LIFECYCLE_ID={lifecycle_id}")
PY
