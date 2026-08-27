"""Form landing ingest via job queue."""
from __future__ import annotations

from typing import Any


def _process_form_ingest_payload_pg(payload: dict[str, Any]) -> dict[str, Any]:
    from ptt_crm.lead_ingest_pg import process_ingest_lead_payload_pg

    outcome = process_ingest_lead_payload_pg(
        {
            "channel": "website",
            "lead": {
                "channel": "website",
                "raw": dict(payload),
            },
        }
    )
    if not outcome.get("ok"):
        return {
            "ok": False,
            "error": outcome.get("error") or "PG form ingest failed",
        }
    created_ids = list(outcome.get("created_ids") or [])
    if created_ids:
        return {"ok": True, "lead_id": int(created_ids[0])}
    return {"ok": False, "error": payload.get("error") or "ingest returned none"}


def process_form_ingest_payload(payload: dict[str, Any]) -> dict[str, Any]:
    return _process_form_ingest_payload_pg(payload)


def run_form_ingest_job(job: dict[str, Any]) -> None:
    from ptt_jobs.handlers.ingest_lead import run_ingest_lead_job  # noqa: F401
    from ptt_jobs.store import JOB_STATUS_DEAD, mark_job_done, mark_job_failed

    job_id = str(job["id"])
    payload = job.get("payload") or {}
    if isinstance(payload, str):
        import json

        payload = json.loads(payload)
    attempts = int(job.get("attempts") or 1)
    max_attempts = int(job.get("max_attempts") or 5)
    outcome = process_form_ingest_payload(payload)
    if outcome.get("ok"):
        mark_job_done(job_id)
        return
    status = mark_job_failed(
        job_id,
        str(outcome.get("error") or "form ingest failed"),
        attempts=attempts,
        max_attempts=max_attempts,
    )
    if status == JOB_STATUS_DEAD:
        import logging

        logging.getLogger(__name__).error("form_ingest dead job_id=%s", job_id)
        try:
            from ptt_jobs.form_ingest_failure import notify_form_ingest_dead

            notify_form_ingest_dead(
                job_id=job_id,
                payload=payload if isinstance(payload, dict) else {},
                error=str(outcome.get("error") or "form ingest failed"),
            )
        except Exception as exc:
            logging.getLogger(__name__).warning("form_ingest dead notify failed: %s", exc)
