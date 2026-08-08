#!/usr/bin/env bash
# Seed one PG lifecycle for MKT-AI pilot smoke/UAT (staging only).
# Idempotent: reuses row when service_slug=meta-lead-gen and notes tag present.
# Also ensures official marketing_plan + optional brief row for apply UAT.
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
import json
import os
import psycopg2

db = os.environ["DATABASE_URL"]
tag = os.environ["MKT_AI_SEED_TAG"]
slug = os.environ["MKT_AI_SEED_SLUG"]
stage = os.environ["MKT_AI_SEED_STAGE"]

brief_json = {
    "brand_name": "ABC Logistics",
    "industry": "Logistics B2B",
    "service_slug": slug,
    "objective": "lead",
    "budget_monthly_vnd": 80000000,
    "geo_markets": ["HCM", "HN"],
    "challenges": "CPL cao, thiếu ICP rõ ràng",
    "competitors": ["Competitor A"],
    "usp": "Giảm CPL 25% trong 90 ngày",
}

conn = psycopg2.connect(db)
conn.autocommit = False
cur = conn.cursor()
cur.execute(
    """
    SELECT id, marketing_plan_id FROM crm_service_lifecycle
    WHERE service_slug = %s AND notes = %s
    ORDER BY id DESC LIMIT 1
    """,
    (slug, tag),
)
row = cur.fetchone()
if row:
    lifecycle_id, plan_id = row[0], row[1]
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
    plan_id = None
    conn.commit()
    print(f"INSERT lifecycle_id={lifecycle_id}")

if not plan_id:
    cur.execute(
        """
        INSERT INTO crm_marketing_plans (
          code, name, status, plan_kind, lifecycle_id,
          north_star, objectives, notes,
          strategy_framework_json, target_market_prof_json, target_market_steps4_json
        )
        VALUES (%s, %s, 'draft', 'official', %s, %s, %s, %s, %s::jsonb, %s::jsonb, %s::jsonb)
        RETURNING id
        """,
        (
            f"LC-{lifecycle_id}-OFFICIAL",
            "ABC Logistics TMMT (chính thức)",
            lifecycle_id,
            "Lead gen logistics B2B",
            "Tăng lead chất lượng Meta + Google",
            "UAT seed official plan",
            json.dumps({"target_market": "SMB logistics VN"}),
            json.dumps({"market_context": "Seed context", "segmentation_icp": "Seed ICP placeholder"}),
            json.dumps({}),
        ),
    )
    plan_id = cur.fetchone()[0]
    cur.execute(
        "UPDATE crm_service_lifecycle SET marketing_plan_id = %s WHERE id = %s",
        (plan_id, lifecycle_id),
    )
    conn.commit()
    print(f"INSERT official marketing_plan_id={plan_id}")
else:
    print(f"REUSE marketing_plan_id={plan_id}")

cur.execute(
    """
    INSERT INTO mkt_ai_briefs (lifecycle_id, brief_json, prefill_sources_json, created_by, updated_by)
    VALUES (%s, %s::jsonb, '[]'::jsonb, 'uat-seed', 'uat-seed')
    ON CONFLICT (lifecycle_id) DO UPDATE
      SET brief_json = EXCLUDED.brief_json,
          updated_by = 'uat-seed',
          updated_at = NOW()
    """,
    (lifecycle_id, json.dumps(brief_json)),
)
conn.commit()
print("UPSERT mkt_ai_briefs")

cur.close()
conn.close()
print(f"OK  LIFECYCLE_ID={lifecycle_id}")
PY
