"""Lead Meeting Prep job pipeline — S-LMP-1 skeleton."""
from __future__ import annotations

import logging
from typing import Any

from ptt_crm.lead_meeting_prep import input_resolver, repository, stub_synthesize

logger = logging.getLogger(__name__)


def process_lead_meeting_prep_payload(
    payload: dict[str, Any], *, correlation_id: str | None = None
) -> dict[str, Any]:
    lead_id = int(payload.get("lead_id") or 0)
    if lead_id <= 0:
        return {"ok": False, "error": "invalid_lead_id"}

    if not repository.table_ready():
        return {"ok": False, "error": "crm_lead_meeting_prep_table_missing"}

    prep_stage = str(payload.get("prep_stage") or "m1_first_strike")
    repository.ensure_row(lead_id, prep_stage=prep_stage)

    row = repository.get_lead_context(lead_id)
    if not row:
        repository.set_status(lead_id, status="failed", error_message="lead_not_found")
        return {"ok": False, "error": "lead_not_found"}

    skip = input_resolver.should_skip_auto(row)
    inp, sources, input_skip = input_resolver.resolve_input(row)
    snapshot = {"input": inp, "sources_map": sources}

    if skip or input_skip:
        reason = skip or input_skip or "skipped"
        repository.set_status(
            lead_id,
            status="skipped",
            skip_reason=reason,
            input_snapshot=snapshot,
            prep_stage=prep_stage,
        )
        return {"ok": True, "skipped": True, "reason": reason, "lead_id": lead_id}

    repository.set_status(lead_id, status="running", input_snapshot=snapshot, prep_stage=prep_stage)

    try:
        collect = stub_synthesize.stub_collect(inp)
        result = stub_synthesize.build_stub_result(inp, collect)
        readiness = stub_synthesize.compute_readiness_score(inp, collect)

        repository.set_status(
            lead_id,
            status="ready",
            collect_json=collect,
            result_json=result,
            tavily_credits=int(collect.get("credits_used") or 0),
            close_readiness_score=readiness,
            prep_stage=prep_stage,
            error_message=None,
        )
        logger.info(
            "lead_meeting_prep ready lead_id=%s readiness=%s correlation=%s",
            lead_id,
            readiness,
            correlation_id,
        )
        return {"ok": True, "lead_id": lead_id, "status": "ready", "close_readiness_score": readiness}
    except Exception as exc:
        repository.set_status(lead_id, status="failed", error_message=str(exc))
        logger.exception("lead_meeting_prep failed lead_id=%s", lead_id)
        return {"ok": False, "error": str(exc), "lead_id": lead_id}
