"""Lead Meeting Prep job pipeline — S-LMP-1b (collect → verify → synthesize)."""
from __future__ import annotations

import logging
import os
from typing import Any

from ptt_crm.lead_meeting_prep import collect, input_resolver, repository, synthesize, verify

logger = logging.getLogger(__name__)


def _tavily_required() -> bool:
    return os.environ.get("LMP_REQUIRE_TAVILY", "0").strip().lower() in {"1", "true", "yes"}


def process_lead_meeting_prep_payload(
    payload: dict[str, Any], *, correlation_id: str | None = None
) -> dict[str, Any]:
    lead_id = int(payload.get("lead_id") or 0)
    if lead_id <= 0:
        return {"ok": False, "error": "invalid_lead_id"}

    if not repository.table_ready():
        return {"ok": False, "error": "crm_lead_meeting_prep_table_missing"}

    prep_stage = str(payload.get("prep_stage") or "m1_first_strike")
    mode = str(payload.get("mode") or "full")
    selected_entity_id = payload.get("selected_entity_id")

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
        if mode == "resume_entity" and selected_entity_id:
            collect_json = repository.get_collect_json(lead_id) or {}
            if not collect_json:
                collect_json = collect.collect_company(inp)
        elif mode in {"full", "refresh", "resume_entity"}:
            if _tavily_required() and not os.environ.get("TAVILY_API_KEY"):
                raise RuntimeError("TAVILY_API_KEY missing")
            collect_json = collect.collect_company(inp)
        else:
            collect_json = repository.get_collect_json(lead_id) or collect.collect_company(inp)

        verification = verify.verify_entities(
            collect_json,
            inp,
            selected_entity_id=str(selected_entity_id) if selected_entity_id else None,
        )

        if verification.get("needs_entity_choice"):
            repository.set_status(
                lead_id,
                status="awaiting_entity_choice",
                collect_json=collect_json,
                entity_candidates=verification.get("entity_candidates") or [],
                prep_stage=prep_stage,
            )
            return {
                "ok": True,
                "lead_id": lead_id,
                "status": "awaiting_entity_choice",
            }

        filtered_collect = verification.get("filtered_collect") or collect_json
        if verification.get("website"):
            filtered_collect = {
                **filtered_collect,
                "verify_website_confidence": verification["website"].get("confidence"),
            }

        synth = synthesize.synthesize_prep(
            inp,
            filtered_collect,
            verify_website=verification.get("website"),
            prep_stage=prep_stage,
            correlation_id=correlation_id,
        )

        repository.set_status(
            lead_id,
            status="ready",
            collect_json=filtered_collect,
            result_json=synth["result"],
            tavily_credits=int(filtered_collect.get("credits_used") or 0),
            close_readiness_score=int(synth.get("readiness_score") or 0),
            prep_stage=prep_stage,
            selected_entity_id=verification.get("selected_entity_id"),
            ai_agent_run_id=synth.get("ai_run_id"),
            error_message=None,
        )
        logger.info(
            "lead_meeting_prep ready lead_id=%s readiness=%s stub=%s correlation=%s",
            lead_id,
            synth.get("readiness_score"),
            synth.get("stub_mode"),
            correlation_id,
        )
        return {
            "ok": True,
            "lead_id": lead_id,
            "status": "ready",
            "close_readiness_score": synth.get("readiness_score"),
            "ai_run_id": synth.get("ai_run_id"),
        }
    except Exception as exc:
        repository.set_status(lead_id, status="failed", error_message=str(exc))
        logger.exception("lead_meeting_prep failed lead_id=%s", lead_id)
        return {"ok": False, "error": str(exc), "lead_id": lead_id}
