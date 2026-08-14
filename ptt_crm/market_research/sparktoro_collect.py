"""SparkToro audience collect — source candidates only (P5 M3). Never create insights."""
from __future__ import annotations

import logging
import os
from typing import Any, Callable

from ptt_crm.market_research import repository
from ptt_crm.market_research.desk_collect import build_desk_query
from ptt_crm.market_research.pii_guard import pii_hint

logger = logging.getLogger(__name__)

SPARKTORO_LIMITATION_NOTE = (
    "Ước lượng audience SparkToro — không phải census. Không suy “người Việt nghĩ rằng…”."
)
MAX_SNIPPET = 500


def _flag_on() -> bool:
    return (os.environ.get("RESEARCH_SPARKTORO_ENABLED") or "").strip().lower() in {
        "1",
        "true",
        "yes",
        "on",
    }


def _api_key() -> str:
    return (os.environ.get("SPARKTORO_API_KEY") or "").strip()


def map_sparktoro_response(raw: Any) -> list[dict[str, Any]]:
    obj = raw if isinstance(raw, dict) else {}
    rows = obj.get("results") or []
    out: list[dict[str, Any]] = []
    if not isinstance(rows, list):
        return out
    for row in rows:
        if not isinstance(row, dict):
            continue
        url = str(row.get("url") or "").strip()
        title = str(row.get("title") or "").strip()
        snippet = str(row.get("snippet") or "").strip()[:MAX_SNIPPET]
        if not url or not title:
            continue
        if snippet and pii_hint(snippet):
            continue
        out.append(
            {
                "url": url,
                "title": title[:500],
                "publisher": "SparkToro",
                "reliability_tier": "medium",
                "limitation_note": SPARKTORO_LIMITATION_NOTE,
                "snippet": snippet,
                "source_type": "web",
                "ai_generated": True,
                "keep": True,
            }
        )
    return out


def collect_sparktoro(
    *,
    question_vi: str,
    geo: list[str] | None = None,
    fetch: Callable[[str, str], dict[str, Any]] | None = None,
) -> dict[str, Any]:
    query = build_desk_query(question_vi, geo)
    empty: dict[str, Any] = {"ok": True, "sources": [], "query": query}
    if not _flag_on() or not _api_key():
        return {**empty, "error": "sparktoro_disabled"}
    getter = fetch or _fetch_sparktoro
    raw = getter(query, _api_key())
    sources = map_sparktoro_response(raw)
    return {**empty, "sources": sources}


def _fetch_sparktoro(_query: str, _api_key: str) -> dict[str, Any]:
    """No live SparkToro HTTP contract in P5 M3 — tests inject a fixture via fetch=."""
    return {"results": []}


def process_research_sparktoro_payload(payload: dict[str, Any]) -> dict[str, Any]:
    project_id = int(payload.get("project_id") or 0)
    question_id = int(payload.get("question_id") or 0)
    run_id = int(payload.get("run_id") or 0)
    empty = {"ok": False, "source_ids": []}
    if project_id <= 0 or question_id <= 0 or run_id <= 0:
        return {**empty, "error": "invalid_payload"}

    ctx = repository.load_desk_context(project_id, question_id)
    if not ctx:
        repository.fail_run(run_id, "not_found")
        return {**empty, "error": "not_found"}

    repository.mark_run_running(run_id)
    result = collect_sparktoro(
        question_vi=str(ctx.get("question_vi") or ""),
        geo=list(ctx.get("geo") or []),
    )
    if result.get("error") == "sparktoro_disabled":
        repository.fail_run(run_id, "sparktoro_disabled")
        return {**result, "source_ids": [], "ok": True, "skipped": True}

    if result.get("ok") is False:
        repository.fail_run(run_id, str(result.get("error") or "sparktoro_failed"))
        return {**result, "source_ids": []}

    source_ids = repository.insert_sparktoro_sources(
        project_id=project_id,
        question_id=question_id,
        sources=list(result.get("sources") or []),
        geo=ctx.get("geo"),
    )
    repository.succeed_run(
        run_id,
        credits_used=0,
        output={"query": result.get("query"), "source_ids": source_ids},
    )
    return {**result, "source_ids": source_ids, "ok": True}
