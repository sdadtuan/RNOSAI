"""Job handler — research desk Tavily collect (M4)."""
from __future__ import annotations

import json
import logging
from typing import Any

from ptt_crm.market_research.desk_collect import (
    TERMINAL_COLLECT_ERRORS,
    process_research_desk_payload,
)
from ptt_jobs.store import mark_job_done, mark_job_failed

logger = logging.getLogger(__name__)


def run_research_desk_job(job: dict[str, Any]) -> None:
    job_id = str(job["id"])
    payload = job.get("payload") or {}
    if isinstance(payload, str):
        payload = json.loads(payload)

    attempts = int(job.get("attempts") or 1)
    max_attempts = int(job.get("max_attempts") or 2)
    run_id = int((payload or {}).get("run_id") or 0)

    try:
        outcome = process_research_desk_payload(payload if isinstance(payload, dict) else {})
    except Exception as exc:
        logger.exception("research_desk_collect crashed job_id=%s", job_id)
        if run_id > 0:
            try:
                from ptt_crm.market_research import repository

                repository.fail_run(run_id, str(exc))
            except Exception:
                logger.exception("research_desk fail_run skipped run_id=%s", run_id)
        mark_job_failed(job_id, str(exc), attempts=attempts, max_attempts=max_attempts)
        return

    if outcome.get("ok"):
        mark_job_done(job_id)
        logger.info(
            "research_desk_collect done job_id=%s run_id=%s sources=%s",
            job_id,
            payload.get("run_id"),
            len(outcome.get("source_ids") or outcome.get("sources") or []),
        )
        return

    error = str(outcome.get("error") or "research_desk_collect failed")
    if error in TERMINAL_COLLECT_ERRORS:
        mark_job_done(job_id)
        logger.warning("research_desk_collect terminal job_id=%s error=%s", job_id, error)
        return

    mark_job_failed(job_id, error, attempts=attempts, max_attempts=max_attempts)
    logger.warning("research_desk_collect failed job_id=%s error=%s", job_id, error)
