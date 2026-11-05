#!/usr/bin/env python3
"""Replay stored ingest payload in-process. Print status only, no PII."""
from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path

JOB_ID = "7b36a7aa-6d56-408c-be4a-1dd461145782"
ROOT = Path("/var/www/rnosai")


def load_env() -> None:
    for line in (ROOT / ".env").read_text(encoding="utf-8", errors="replace").splitlines():
        s = line.strip()
        if not s or s.startswith("#") or "=" not in s:
            continue
        k, v = s.split("=", 1)
        os.environ.setdefault(k, v.strip().strip("\"'"))


def main() -> int:
    load_env()
    sys.path.insert(0, str(ROOT))
    print("has_skip_helper", "_skip_facebook_source_filter" in (ROOT / "ptt_crm" / "lead_ingest_pg.py").read_text())
    url = os.environ.get("DATABASE_URL", "")
    proc = subprocess.run(
        [
            "psql",
            url,
            "-tAc",
            f"SELECT payload::text FROM job_queue WHERE id = '{JOB_ID}'",
        ],
        capture_output=True,
        text=True,
    )
    if proc.returncode:
        print(proc.stderr[-400:])
        return proc.returncode
    payload = json.loads(proc.stdout)
    lead = payload.get("lead") if isinstance(payload.get("lead"), dict) else {}
    contact = lead.get("contact") if isinstance(lead.get("contact"), dict) else {}
    raw = lead.get("raw") if isinstance(lead.get("raw"), dict) else {}
    raw_meta = raw.get("meta") if isinstance(raw.get("meta"), dict) else {}
    print(
        "payload",
        {
            "b2b_project_id": bool(payload.get("b2b_project_id")),
            "lead_flow_kind": payload.get("lead_flow_kind"),
            "channel": payload.get("channel"),
            "has_contact_phone": bool(contact.get("phone")),
            "has_contact_email": bool(contact.get("email")),
            "has_raw_phone": bool(raw.get("phone")),
            "external_form_id": bool(lead.get("external_form_id")),
            "raw_form": bool(raw_meta.get("facebook_form_id")),
            "raw_leadgen": bool(raw_meta.get("facebook_leadgen_id")),
        },
    )
    from ptt_channel.mappers import normalized_lead_to_legacy
    from ptt_crm.lead_ingest_pg import _skip_facebook_source_filter

    legacy = normalized_lead_to_legacy(lead)
    if payload.get("b2b_project_id"):
        legacy["b2b_project_id"] = payload["b2b_project_id"]
    if payload.get("lead_flow_kind"):
        legacy["lead_flow_kind"] = payload["lead_flow_kind"]
    print(
        "legacy",
        {
            "skip_filter": _skip_facebook_source_filter(legacy),
            "has_phone": bool(legacy.get("phone")),
            "has_email": bool(legacy.get("email")),
            "has_b2b": bool(legacy.get("b2b_project_id")),
            "meta_keys": sorted((legacy.get("meta") or {}).keys()) if isinstance(legacy.get("meta"), dict) else [],
        },
    )
    from ptt_crm.lead_ingest_pg import process_ingest_lead_payload_pg

    out = process_ingest_lead_payload_pg(payload, correlation_id="replay-dry")
    print(
        "ingest",
        {
            "ok": out.get("ok"),
            "error": str(out.get("error") or "")[:240],
            "created_count": out.get("created_count"),
            "created_ids": out.get("created_ids"),
            "skipped": [
                {
                    "status": r.get("status"),
                    "message": str(r.get("message") or "")[:180],
                }
                for r in (out.get("skipped") or [])
            ],
            "results": [
                {
                    "status": r.get("status"),
                    "message": str(r.get("message") or "")[:180],
                    "lead_id": r.get("lead_id"),
                }
                for r in (out.get("results") or [])
            ],
        },
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
