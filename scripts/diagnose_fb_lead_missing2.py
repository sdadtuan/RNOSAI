#!/usr/bin/env python3
"""Why ingest_lead done but crm_leads empty. No PII/secrets."""
from __future__ import annotations

import os
import sqlite3
import subprocess
from pathlib import Path


def load_env() -> dict[str, str]:
    out: dict[str, str] = {}
    for line in Path("/var/www/rnosai/.env").read_text(encoding="utf-8", errors="replace").splitlines():
        s = line.strip()
        if not s or s.startswith("#") or "=" not in s:
            continue
        k, v = s.split("=", 1)
        out[k] = v.strip().strip("\"'")
    return out


def psql(url: str, sql: str) -> str:
    proc = subprocess.run(
        ["psql", url, "-v", "ON_ERROR_STOP=1", "-c", sql],
        capture_output=True,
        text=True,
    )
    if proc.returncode:
        return (proc.stdout + "\n" + proc.stderr)[-2000:]
    return proc.stdout


def main() -> int:
    env = load_env()
    url = env.get("DATABASE_URL", "")
    if not url:
        print("missing DATABASE_URL")
        return 1
    print("PTT_LEADS_WRITE_SOURCE", env.get("PTT_LEADS_WRITE_SOURCE", "(unset)"))
    print("PTT_B2B_PROJECT_OS", env.get("PTT_B2B_PROJECT_OS", "(unset)"))
    print("PTT_JOBS_ENABLED", env.get("PTT_JOBS_ENABLED", "(unset)"))

    print("=== pg counts / events / job ===")
    print(
        psql(
            url,
            """
SELECT count(*) AS pg_crm_leads FROM crm_leads;
SELECT event_type,
       payload->>'created_count' AS created_count,
       payload->>'lead_id' AS lead_id,
       payload->>'write_path' AS write_path,
       left(coalesce(payload->>'job_id',''), 12) AS job_id,
       created_at
FROM domain_events
WHERE created_at > now() - interval '6 hours'
  AND event_type IN ('LeadCreated','JobCompleted')
ORDER BY created_at DESC
LIMIT 15;
SELECT payload ? 'lead' AS has_lead,
       payload->>'lead_flow_kind' AS flow,
       (payload->>'b2b_project_id' IS NOT NULL) AS has_project,
       payload->'lead'->'meta'->>'facebook_form_id' AS form_id,
       payload->'lead'->'meta'->>'facebook_page_id' AS page_id,
       length(coalesce(payload->'lead'->>'phone','')) AS phone_len,
       length(coalesce(payload->'lead'->>'email','')) AS email_len
FROM job_queue
WHERE id = '7b36a7aa-6d56-408c-be4a-1dd461145782';
""",
        )
    )

    print("=== ingest snapshot facebook_config ===")
    print(
        psql(
            url,
            """
SELECT lead_config ? 'facebook_config' AS has_fb,
       lead_config->'facebook_config'->>'enabled' AS enabled,
       lead_config->'facebook_config'->>'page_id' AS page_id,
       lead_config->'facebook_config'->'form_ids' AS form_ids
FROM crm_ingest_rules_snapshot
WHERE id = 1;
""",
        )
    )

    sqlite_path = env.get("PTT_SQLITE_DB") or env.get("SQLITE_DB_PATH") or ""
    candidates = [p for p in [sqlite_path, "/var/www/rnosai/data/ptt.db", "/var/www/rnosai/crm.db"] if p]
    for path in candidates:
        if Path(path).is_file():
            print("sqlite", path)
            conn = sqlite3.connect(path)
            try:
                tables = [r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()]
                print("tables_have_leads", "crm_leads" in tables)
                if "crm_leads" in tables:
                    print("sqlite_crm_leads", conn.execute("SELECT count(*) FROM crm_leads").fetchone()[0])
            finally:
                conn.close()
            break
    else:
        print("sqlite_db_not_found")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
