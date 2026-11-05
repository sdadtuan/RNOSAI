#!/usr/bin/env python3
"""VPS: find why a synced Facebook lead is missing from /crm/b2b/leads. No secrets/PII."""
from __future__ import annotations

import os
import subprocess
from pathlib import Path


def load_database_url() -> str:
    for line in Path("/var/www/rnosai/.env").read_text(encoding="utf-8", errors="replace").splitlines():
        s = line.strip()
        if s.startswith("DATABASE_URL="):
            return s.split("=", 1)[1].strip().strip("\"'")
    raise SystemExit("missing DATABASE_URL")


def main() -> int:
    env = os.environ.copy()
    env["DATABASE_URL"] = load_database_url()
    sql = r"""
SELECT 'jobs' AS section;
SELECT status, count(*) 
FROM job_queue
WHERE job_type='ingest_lead' AND created_at > now() - interval '2 days'
GROUP BY 1 ORDER BY 2 DESC;

SELECT id::text, status, left(coalesce(last_error,''),160) AS err,
       left(coalesce(correlation_id,''),80) AS corr,
       created_at, finished_at
FROM job_queue
WHERE job_type='ingest_lead'
ORDER BY created_at DESC
LIMIT 8;

SELECT 'crm_leads_recent' AS section;
SELECT sqlite_lead_id, status, source, channel,
       (owner_id IS NOT NULL) AS has_owner,
       is_duplicate,
       (b2b_project_id IS NOT NULL) AS has_project,
       coalesce(meta_json->>'lead_flow_kind','') AS flow,
       (agency_client_id IS NOT NULL) AS has_client,
       left(coalesce(external_lead_id,''),24) AS ext,
       created_at
FROM crm_leads
ORDER BY created_at DESC NULLS LAST
LIMIT 10;

SELECT 'b2b_list_would_match' AS section;
SELECT count(*) AS n
FROM crm_leads l
WHERE l.is_duplicate IS NOT TRUE
  AND (
    lower(trim(COALESCE(l.meta_json->>'lead_flow_kind', l.meta_json->>'lead_flow', '')))
      IN ('b2b_prospect', 'b2b')
    OR lower(trim(COALESCE(l.status, ''))) IN ('won', 'proposal')
    OR (
      lower(trim(COALESCE(l.meta_json->>'lead_flow_kind', l.meta_json->>'lead_flow', '')))
        NOT IN ('spa_operational', 'spa')
      AND l.agency_client_id IS NULL
    )
  );

SELECT 'unmatched' AS section;
SELECT id::text, channel, project_slug, left(coalesce(external_key,''),40) AS ext,
       left(payload_json::text,180) AS payload, created_at
FROM crm_b2b_unmatched_ingress
ORDER BY created_at DESC
LIMIT 8;

SELECT 'project_staff' AS section;
SELECT p.code, s.staff_id, s.assign_enabled, s.can_receive_leads
FROM crm_b2b_projects p
JOIN crm_b2b_project_staff s ON s.project_id=p.id
WHERE p.code='ptt-hcm';

SELECT 'lead_counts' AS section;
SELECT count(*) AS all_leads,
       count(*) FILTER (WHERE created_at > now() - interval '1 day') AS last_24h,
       count(*) FILTER (WHERE source='facebook') AS facebook,
       count(*) FILTER (WHERE is_duplicate) AS dups
FROM crm_leads;
"""
    proc = subprocess.run(
        ["psql", env["DATABASE_URL"], "-v", "ON_ERROR_STOP=1", "-c", sql],
        env=env,
        capture_output=True,
        text=True,
    )
    print(proc.stdout)
    if proc.returncode:
        print(proc.stderr[-800:])
        return proc.returncode
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
