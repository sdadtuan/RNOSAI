"""Ingest normalized lead into PostgreSQL CRM."""
from __future__ import annotations

from typing import Any

from ptt_jobs.events import emit_domain_event
from ptt_jobs.store import JOB_STATUS_DEAD, mark_job_done, mark_job_failed

def process_ingest_lead_payload(
    payload: dict[str, Any],
    *,
    correlation_id: str | None = None,
) -> dict[str, Any]:
    from ptt_crm.lead_ingest_pg import process_ingest_lead_payload_pg

    return process_ingest_lead_payload_pg(payload, correlation_id=correlation_id)


def run_ingest_lead_job(job: dict[str, Any]) -> None:
    job_id = str(job["id"])
    payload = job.get("payload") or {}
    if isinstance(payload, str):
        import json

        payload = json.loads(payload)

    correlation_id = job.get("correlation_id")
    attempts = int(job.get("attempts") or 1)
    max_attempts = int(job.get("max_attempts") or 5)

    outcome = process_ingest_lead_payload(payload, correlation_id=correlation_id)
    if outcome.get("ok"):
        mark_job_done(job_id)
        emit_domain_event(
            "JobCompleted",
            "job",
            job_id,
            {
                "job_id": job_id,
                "job_type": "ingest_lead",
                "status": "done",
                "correlation_id": correlation_id,
                "created_count": outcome.get("created_count", 0),
            },
            correlation_id=correlation_id,
        )
        return

    error = str(outcome.get("error") or "ingest failed")
    status = mark_job_failed(job_id, error, attempts=attempts, max_attempts=max_attempts)
    if status == JOB_STATUS_DEAD:
        emit_domain_event(
            "JobDead",
            "job",
            job_id,
            {
                "job_id": job_id,
                "job_type": "ingest_lead",
                "last_error": error,
                "correlation_id": correlation_id,
            },
            correlation_id=correlation_id,
        )
