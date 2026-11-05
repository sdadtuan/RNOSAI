#!/usr/bin/env python3
"""Reset the filtered Facebook ingest job so the worker retries. No secrets printed."""
from __future__ import annotations

import subprocess
from pathlib import Path

JOB_ID = "7b36a7aa-6d56-408c-be4a-1dd461145782"


def database_url() -> str:
    for line in Path("/var/www/rnosai/.env").read_text(encoding="utf-8", errors="replace").splitlines():
        s = line.strip()
        if s.startswith("DATABASE_URL="):
            return s.split("=", 1)[1].strip().strip("\"'")
    raise SystemExit("missing DATABASE_URL")


def main() -> int:
    url = database_url()
    sql = f"""
UPDATE job_queue
SET status = 'pending',
    finished_at = NULL,
    started_at = NULL,
    last_error = NULL,
    attempts = 0,
    updated_at = NOW()
WHERE id = '{JOB_ID}'
RETURNING id::text, status, job_type;
SELECT count(*) AS pg_crm_leads FROM crm_leads;
"""
    proc = subprocess.run(["psql", url, "-v", "ON_ERROR_STOP=1", "-c", sql], capture_output=True, text=True)
    print(proc.stdout)
    if proc.returncode:
        print(proc.stderr[-600:])
        return proc.returncode
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
