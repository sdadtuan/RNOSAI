#!/usr/bin/env python3
from __future__ import annotations

import subprocess
from pathlib import Path

JOB_ID = "7b36a7aa-6d56-408c-be4a-1dd461145782"


def main() -> int:
    url = ""
    for line in Path("/var/www/rnosai/.env").read_text(encoding="utf-8", errors="replace").splitlines():
        s = line.strip()
        if s.startswith("DATABASE_URL="):
            url = s.split("=", 1)[1].strip().strip("\"'")
            break
    sql = f"""
SELECT status, left(coalesce(last_error,''),180) AS err, finished_at
FROM job_queue WHERE id = '{JOB_ID}';
SELECT count(*) AS pg_crm_leads FROM crm_leads;
SELECT sqlite_lead_id, status, source, channel,
       (b2b_project_id IS NOT NULL) AS has_project,
       coalesce(meta_json->>'lead_flow_kind','') AS flow,
       is_duplicate, (owner_id IS NOT NULL) AS has_owner
FROM crm_leads
ORDER BY created_at DESC
LIMIT 5;
"""
    proc = subprocess.run(["psql", url, "-c", sql], capture_output=True, text=True)
    print(proc.stdout)
    if proc.returncode:
        print(proc.stderr[-500:])
        return proc.returncode
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
