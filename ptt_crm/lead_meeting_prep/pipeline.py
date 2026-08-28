"""Lead Meeting Prep job pipeline — S-LMP-3 (collect → verify → synthesize → strategize → arm)."""
from __future__ import annotations

import json
import logging
import os
from datetime import datetime, timezone
from typing import Any

from ptt_crm.lead_meeting_prep import (
    apify_facebook,
    close_intelligence,
    collect,
    discover,
    input_resolver,
    repository,
    synthesize,
    verify,
)

logger = logging.getLogger(__name__)

COLLECT_REUSE_HOURS = int(os.environ.get("LMP_M2_COLLECT_REUSE_HOURS", "24") or "24")


def _collect_is_fresh(collect_json: dict[str, Any], updated_at: str | None) -> bool:
    if not collect_json:
        return False
    researched = collect_json.get("researched_at") or collect_json.get("collected_at")
    ts = researched or updated_at
    if not ts:
        return False
    try:
        if isinstance(ts, str):
            dt = datetime.fromisoformat(ts.replace("Z", "+00:00"))
        else:
            return False
    except ValueError:
        return False
    age_h = (datetime.now(timezone.utc) - dt.astimezone(timezone.utc)).total_seconds() / 3600.0
    return age_h <= COLLECT_REUSE_HOURS


def _tavily_required() -> bool:
    return os.environ.get("LMP_REQUIRE_TAVILY", "0").strip().lower() in {"1", "true", "yes"}


def _discover_collect_shell(discover_result: dict[str, Any], credits: int) -> dict[str, Any]:
    return {
        "discover": discover_result,
        "discover_status": discover_result.get("discover_status"),
        "discover_message_vi": discover_result.get("discover_message_vi"),
        "credits_used": credits,
        "researched_at": (discover_result.get("meta") or {}).get("discovered_at"),
        "company_sources": [],
        "company_found": False,
        "partial": True,
        "stub": False,
        "queries": (discover_result.get("query_context") or {}).get("tavily_queries") or [],
    }


def _apply_discover_selection(
    lead_id: int,
    inp: dict[str, Any],
    discover_result: dict[str, Any],
    candidate_id: str,
) -> dict[str, Any]:
    out = discover.apply_candidate_to_input(inp, discover_result, candidate_id)
    patch = discover.discover_meta_patch(discover_result, candidate_id)
    if patch:
        repository.merge_lead_meta(lead_id, patch)
    return out


def _handle_discover_phase(
    lead_id: int,
    inp: dict[str, Any],
    row: dict[str, Any],
    *,
    prep_stage: str,
    snapshot: dict[str, Any],
    correlation_id: str | None,
    selected_entity_id: str | None = None,
) -> tuple[dict[str, Any], dict[str, Any], str | None] | dict[str, Any]:
    """
    Run Discover when company_name missing.
    Returns early response dict, or (inp, collect_json, selected_id) to continue pipeline.
    """
    meta = row.get("meta_json") if isinstance(row.get("meta_json"), dict) else {}
    existing_collect = repository.get_collect_json(lead_id) or {}
    existing_discover = existing_collect.get("discover") if isinstance(existing_collect.get("discover"), dict) else None

    if mode_selected := selected_entity_id:
        discover_result = existing_discover
        if not discover_result:
            return {
                "ok": False,
                "error": "discover_context_missing",
                "lead_id": lead_id,
            }
        inp = _apply_discover_selection(lead_id, inp, discover_result, str(mode_selected))
        snapshot = {**snapshot, "input": inp}
        collect_json = {**existing_collect, "discover": discover_result}
        return inp, collect_json, str(mode_selected)

    repository.set_status(lead_id, status="running", input_snapshot=snapshot, prep_stage=prep_stage)
    discover_result, credits = discover.run_discover(inp, meta, correlation_id=correlation_id)
    collect_json = _discover_collect_shell(discover_result, credits)
    status = str(discover_result.get("discover_status") or "not_found")

    if status == "found_single":
        cand_id = str(
            discover_result.get("recommended_candidate_id")
            or (discover_result.get("candidates") or [{}])[0].get("candidate_id")
            or ""
        )
        if cand_id:
            inp = _apply_discover_selection(lead_id, inp, discover_result, cand_id)
            snapshot = {**snapshot, "input": inp, "sources_map": {**snapshot.get("sources_map", {}), "company_name": f"discover:{cand_id}"}}
            collect_json["company_name_resolved"] = inp.get("company_name")
            return inp, collect_json, cand_id

    if status == "found_multiple":
        entity_candidates = discover.to_entity_candidates(discover_result)
        repository.set_status(
            lead_id,
            status="awaiting_entity_choice",
            skip_reason="discover_multiple",
            collect_json=collect_json,
            entity_candidates=entity_candidates,
            input_snapshot=snapshot,
            prep_stage=prep_stage,
            tavily_credits=credits,
        )
        return {
            "ok": True,
            "lead_id": lead_id,
            "status": "awaiting_entity_choice",
            "discover_status": status,
        }

    if status == "tier1_only" and discover_result.get("candidates"):
        entity_candidates = discover.to_entity_candidates(discover_result)
        repository.set_status(
            lead_id,
            status="awaiting_am_input",
            skip_reason="discover_tier1_only",
            collect_json=collect_json,
            entity_candidates=entity_candidates,
            input_snapshot=snapshot,
            prep_stage=prep_stage,
            tavily_credits=credits,
        )
        return {
            "ok": True,
            "lead_id": lead_id,
            "status": "awaiting_am_input",
            "discover_status": status,
            "awaiting_am_input": True,
        }

    repository.set_status(
        lead_id,
        status="awaiting_am_input",
        skip_reason="discover_not_found",
        collect_json=collect_json,
        input_snapshot=snapshot,
        prep_stage=prep_stage,
        tavily_credits=credits,
    )
    return {
        "ok": True,
        "lead_id": lead_id,
        "status": "awaiting_am_input",
        "discover_status": status,
        "awaiting_am_input": True,
    }


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

    if mode == "learn" or prep_stage == "m4_learn":
        from ptt_crm.lead_meeting_prep import learn

        return learn.process_learn(lead_id, payload=payload)

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

    am_input = input_resolver.needs_am_input(inp)
    needs_discover = bool(am_input and prep_stage == "m1_first_strike")
    discover_selected_collect: dict[str, Any] | None = None

    if needs_discover and mode == "resume_entity" and selected_entity_id:
        discover_out = _handle_discover_phase(
            lead_id,
            inp,
            row,
            prep_stage=prep_stage,
            snapshot=snapshot,
            correlation_id=correlation_id,
            selected_entity_id=str(selected_entity_id),
        )
        if isinstance(discover_out, dict):
            if not discover_out.get("ok"):
                repository.set_status(lead_id, status="failed", error_message=str(discover_out.get("error")))
            return discover_out
        inp, discover_selected_collect, selected_entity_id = discover_out
        snapshot = {**snapshot, "input": inp}
        needs_discover = False
    elif needs_discover and mode in {"discover", "full"}:
        discover_out = _handle_discover_phase(
            lead_id,
            inp,
            row,
            prep_stage=prep_stage,
            snapshot=snapshot,
            correlation_id=correlation_id,
        )
        if isinstance(discover_out, dict):
            return discover_out
        inp, discover_selected_collect, selected_entity_id = discover_out
        snapshot = {**snapshot, "input": inp}
        needs_discover = False
    elif needs_discover:
        repository.set_status(
            lead_id,
            status="awaiting_am_input",
            skip_reason=am_input,
            input_snapshot=snapshot,
            prep_stage=prep_stage,
        )
        return {"ok": True, "awaiting_am_input": True, "reason": am_input, "lead_id": lead_id}

    repository.set_status(lead_id, status="running", input_snapshot=snapshot, prep_stage=prep_stage)

    try:
        apify_runs = 0
        if mode == "strategize_arm":
            collect_json = repository.get_collect_json(lead_id) or {}
            existing_result = repository.get_result_json(lead_id) or {}
            meta = existing_result.get("meta") if isinstance(existing_result, dict) else {}
            researched_at = meta.get("researched_at") if isinstance(meta, dict) else None
            if not collect_json or not _collect_is_fresh(collect_json, str(researched_at or "")):
                if prep_stage in {"m2_qualify_win", "m3_pre_close"} or not collect_json:
                    collect_json = collect.collect_company(inp)
            verification = {"filtered_collect": collect_json, "website": None}
            if existing_result and isinstance(existing_result, dict):
                synth = _rearm_only(
                    inp,
                    collect_json,
                    existing_result,
                    prep_stage=prep_stage,
                    correlation_id=correlation_id,
                )
                return _finalize_ready(
                    lead_id,
                    inp,
                    collect_json,
                    verification,
                    synth,
                    prep_stage=prep_stage,
                    apify_runs=0,
                )
        elif mode == "resume_entity" and selected_entity_id:
            collect_json = discover_selected_collect or repository.get_collect_json(lead_id) or {}
            if not collect_json.get("company_sources"):
                collect_json = {**collect_json, **collect.collect_company(inp)}
            elif discover_selected_collect:
                merged = collect.collect_company(inp)
                collect_json = {**collect_json, **merged, "discover": collect_json.get("discover")}
        elif mode in {"full", "refresh", "resume_entity"}:
            if _tavily_required() and not os.environ.get("TAVILY_API_KEY"):
                raise RuntimeError("TAVILY_API_KEY missing")
            collect_json = collect.collect_company(inp)
        else:
            collect_json = repository.get_collect_json(lead_id) or collect.collect_company(inp)

        social, apify_runs = apify_facebook.enrich_social_channels(inp, collect_json)
        if social:
            collect_json = {**collect_json, "social_channels": social}

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

        return _finalize_ready(
            lead_id,
            inp,
            filtered_collect,
            verification,
            synth,
            prep_stage=prep_stage,
            apify_runs=apify_runs,
            selected_entity_id=verification.get("selected_entity_id"),
        )
    except Exception as exc:
        repository.set_status(lead_id, status="failed", error_message=str(exc))
        logger.exception("lead_meeting_prep failed lead_id=%s", lead_id)
        return {"ok": False, "error": str(exc), "lead_id": lead_id}


def _rearm_only(
    inp: dict[str, Any],
    collect_json: dict[str, Any],
    existing_result: dict[str, Any],
    *,
    prep_stage: str,
    correlation_id: str | None,
) -> dict[str, Any]:
    result = json.loads(json.dumps(existing_result))
    enriched = close_intelligence.enrich_close_intelligence(
        result,
        inp,
        collect_json,
        prep_stage=prep_stage,
        correlation_id=correlation_id,
    )
    return {
        "result": result,
        "readiness_score": enriched["readiness_score"],
        "readiness_breakdown": enriched.get("readiness_breakdown"),
        "ai_run_id": None,
        "stub_mode": True,
    }


def _finalize_ready(
    lead_id: int,
    inp: dict[str, Any],
    filtered_collect: dict[str, Any],
    verification: dict[str, Any],
    synth: dict[str, Any],
    *,
    prep_stage: str,
    apify_runs: int = 0,
    selected_entity_id: str | None = None,
) -> dict[str, Any]:
    result = synth.get("result") or {}
    if social := filtered_collect.get("social_channels"):
        result["social_channels"] = social

    repository.set_status(
        lead_id,
        status="ready",
        collect_json=filtered_collect,
        result_json=result,
        tavily_credits=int(filtered_collect.get("credits_used") or 0),
        close_readiness_score=int(synth.get("readiness_score") or 0),
        prep_stage=prep_stage,
        selected_entity_id=selected_entity_id or verification.get("selected_entity_id"),
        ai_agent_run_id=synth.get("ai_run_id"),
        apify_runs=apify_runs,
        error_message=None,
    )

    try:
        from ptt_crm.timeline_events import record_lead_meeting_prep_ready_timeline

        services = result.get("recommended_services") or []
        record_lead_meeting_prep_ready_timeline(
            lead_id=lead_id,
            client_id=str(inp.get("client_id") or "") or None,
            dv_codes=[str(s.get("dv_code") or "") for s in services if isinstance(s, dict)],
            dv_names=[str(s.get("name_vi") or "") for s in services if isinstance(s, dict)],
            prep_version=1,
        )
    except Exception as exc:
        logger.debug("timeline lmp ready skipped lead=%s: %s", lead_id, exc)

    logger.info(
        "lead_meeting_prep ready lead_id=%s readiness=%s stub=%s",
        lead_id,
        synth.get("readiness_score"),
        synth.get("stub_mode"),
    )
    return {
        "ok": True,
        "lead_id": lead_id,
        "status": "ready",
        "close_readiness_score": synth.get("readiness_score"),
        "ai_run_id": synth.get("ai_run_id"),
    }
