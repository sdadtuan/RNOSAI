"""PostgreSQL persistence for desk Tavily runs and AI sources."""
from __future__ import annotations

import json
import logging
from typing import Any

from ptt_jobs.db import json_dumps, pg_connection

logger = logging.getLogger(__name__)


def _as_list(val: Any) -> list[str]:
    if val is None:
        return []
    if isinstance(val, list):
        return [str(x) for x in val]
    if isinstance(val, str):
        try:
            parsed = json.loads(val)
            if isinstance(parsed, list):
                return [str(x) for x in parsed]
        except json.JSONDecodeError:
            return [val]
    return []


def load_desk_context(project_id: int, question_id: int) -> dict[str, Any] | None:
    with pg_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT q.question_vi, p.geo
                FROM crm_research_questions q
                JOIN crm_research_projects p ON p.id = q.project_id
                WHERE q.id = %s AND q.project_id = %s
                """,
                (question_id, project_id),
            )
            row = cur.fetchone()
            if not row:
                return None
            return {"question_vi": str(row[0] or ""), "geo": _as_list(row[1])}


def sum_project_tavily_credits(project_id: int, *, exclude_run_id: int | None = None) -> int:
    with pg_connection() as conn:
        with conn.cursor() as cur:
            if exclude_run_id:
                cur.execute(
                    """
                    SELECT COALESCE(SUM(credits_used), 0)::int
                    FROM crm_research_ai_runs
                    WHERE project_id = %s
                      AND job_type = 'desk_tavily'
                      AND id <> %s
                    """,
                    (project_id, exclude_run_id),
                )
            else:
                cur.execute(
                    """
                    SELECT COALESCE(SUM(credits_used), 0)::int
                    FROM crm_research_ai_runs
                    WHERE project_id = %s AND job_type = 'desk_tavily'
                    """,
                    (project_id,),
                )
            row = cur.fetchone()
            return int(row[0] if row else 0)


def mark_run_running(run_id: int) -> None:
    with pg_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE crm_research_ai_runs
                SET status = 'running'
                WHERE id = %s AND status IN ('pending', 'running')
                """,
                (run_id,),
            )
        conn.commit()


def fail_run(run_id: int, error: str, *, credits_used: int = 0) -> None:
    with pg_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE crm_research_ai_runs
                SET status = 'failed',
                    error_message = %s,
                    credits_used = %s,
                    finished_at = now()
                WHERE id = %s
                """,
                (str(error)[:2000], int(credits_used or 0), run_id),
            )
        conn.commit()


def succeed_run(run_id: int, *, credits_used: int, output: dict[str, Any]) -> None:
    with pg_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE crm_research_ai_runs
                SET status = 'succeeded',
                    error_message = NULL,
                    credits_used = %s,
                    output_json = %s::jsonb,
                    finished_at = now()
                WHERE id = %s
                """,
                (int(credits_used or 0), json_dumps(output), run_id),
            )
        conn.commit()


def insert_ai_sources(
    *,
    project_id: int,
    question_id: int,
    sources: list[dict[str, Any]],
    geo: list[str] | None = None,
) -> list[int]:
    ids: list[int] = []
    geo_text = (geo or [None])[0] if geo else None
    with pg_connection() as conn:
        with conn.cursor() as cur:
            for src in sources:
                title = str(src.get("title") or src.get("url") or "").strip()
                url = str(src.get("url") or "").strip() or None
                if not title:
                    continue
                cur.execute(
                    """
                    INSERT INTO crm_research_sources (
                      project_id, question_id, source_type, title, publisher, url,
                      accessed_at, geo, reliability_tier, ai_generated, keep
                    ) VALUES (
                      %s, %s, %s, %s, %s, %s, now(), %s, 'unknown', true, NULL
                    )
                    RETURNING id
                    """,
                    (
                        project_id,
                        question_id,
                        str(src.get("source_type") or "web"),
                        title[:500],
                        (str(src.get("publisher") or "").strip() or None),
                        url,
                        geo_text,
                    ),
                )
                row = cur.fetchone()
                if row:
                    ids.append(int(row[0]))
        conn.commit()
    return ids
