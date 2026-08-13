"""PostgreSQL persistence for crm_lead_meeting_prep."""
from __future__ import annotations

import json
import logging
from typing import Any

from ptt_jobs.db import pg_connection, pg_available

logger = logging.getLogger(__name__)


def table_ready() -> bool:
    if not pg_available():
        return False
    with pg_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT 1 FROM information_schema.tables
                WHERE table_schema = 'public' AND table_name = 'crm_lead_meeting_prep'
                """
            )
            return cur.fetchone() is not None


def get_lead_context(lead_id: int) -> dict[str, Any] | None:
    with pg_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT l.sqlite_lead_id AS lead_id,
                       l.full_name, l.phone, l.email, l.status, l.source, l.channel,
                       l.agency_client_id::text AS client_id,
                       l.is_duplicate,
                       COALESCE(l.meta_json, '{}'::jsonb) AS meta_json
                FROM crm_leads l
                WHERE l.sqlite_lead_id = %s
                """,
                (lead_id,),
            )
            row = cur.fetchone()
            if not row:
                return None
            cols = [d[0] for d in cur.description]
            out = dict(zip(cols, row))
            if isinstance(out.get("meta_json"), str):
                out["meta_json"] = json.loads(out["meta_json"])
            return out


def get_collect_json(lead_id: int) -> dict[str, Any] | None:
    with pg_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT collect_json FROM crm_lead_meeting_prep WHERE lead_id = %s",
                (lead_id,),
            )
            row = cur.fetchone()
            if not row or row[0] is None:
                return None
            val = row[0]
            if isinstance(val, str):
                return json.loads(val)
            return dict(val)


def set_status(
    lead_id: int,
    *,
    status: str,
    skip_reason: str | None = None,
    error_message: str | None = None,
    collect_json: dict[str, Any] | None = None,
    entity_candidates: list[Any] | None = None,
    result_json: dict[str, Any] | None = None,
    input_snapshot: dict[str, Any] | None = None,
    tavily_credits: int | None = None,
    close_readiness_score: int | None = None,
    prep_stage: str | None = None,
    selected_entity_id: str | None = None,
    ai_agent_run_id: str | None = None,
) -> None:
    sets = ["status = %s", "updated_at = NOW()"]
    params: list[Any] = [status]

    if skip_reason is not None:
        sets.append("skip_reason = %s")
        params.append(skip_reason)
    if error_message is not None:
        sets.append("error_message = %s")
        params.append(error_message)
    if collect_json is not None:
        sets.append("collect_json = %s::jsonb")
        params.append(json.dumps(collect_json))
    if entity_candidates is not None:
        sets.append("entity_candidates_json = %s::jsonb")
        params.append(json.dumps(entity_candidates))
    if result_json is not None:
        sets.append("result_json = %s::jsonb")
        params.append(json.dumps(result_json))
    if input_snapshot is not None:
        sets.append("input_snapshot_json = %s::jsonb")
        params.append(json.dumps(input_snapshot))
    if tavily_credits is not None:
        sets.append("tavily_credits_used = %s")
        params.append(tavily_credits)
    if close_readiness_score is not None:
        sets.append("close_readiness_score = %s")
        params.append(close_readiness_score)
    if prep_stage is not None:
        sets.append("prep_stage = %s")
        params.append(prep_stage)
    if selected_entity_id is not None:
        sets.append("selected_entity_id = %s")
        params.append(selected_entity_id)
    if ai_agent_run_id is not None:
        sets.append("ai_agent_run_id = %s::uuid")
        params.append(ai_agent_run_id)

    params.append(lead_id)
    sql = f"UPDATE crm_lead_meeting_prep SET {', '.join(sets)} WHERE lead_id = %s"

    with pg_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, params)
        conn.commit()


def ensure_row(lead_id: int, prep_stage: str = "m1_first_strike") -> None:
    with pg_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO crm_lead_meeting_prep (lead_id, status, prep_stage)
                VALUES (%s, 'pending', %s)
                ON CONFLICT (lead_id) DO NOTHING
                """,
                (lead_id, prep_stage),
            )
        conn.commit()
