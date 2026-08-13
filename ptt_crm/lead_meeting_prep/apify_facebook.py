"""Apify Facebook enrichment — graceful fail (S-LMP-3)."""
from __future__ import annotations

import logging
import os
from typing import Any

logger = logging.getLogger(__name__)


def enrich_social_channels(
    inp: dict[str, Any],
    collect: dict[str, Any],
) -> tuple[list[dict[str, Any]], int]:
    """
    Returns (social_channels, apify_runs_count).
    Never raises — prep continues when Apify unavailable.
    """
    token = (os.environ.get("APIFY_API_TOKEN") or os.environ.get("APIFY_TOKEN") or "").strip()
    social_url = (
        inp.get("social_urls")
        or inp.get("facebook_page_url")
        or _extract_fb_from_collect(collect)
    )
    if not token or not social_url:
        return [], 0

    if os.environ.get("LMP_APIFY_ENABLED", "0").strip().lower() not in {"1", "true", "yes"}:
        return [], 0

    try:
        # Placeholder for Apify actors — return derived metrics only when wired.
        logger.info("lmp apify skipped (actors not wired) url=%s", str(social_url)[:80])
        return [], 0
    except Exception as exc:
        logger.warning("lmp apify failed: %s", exc)
        return [], 0


def _extract_fb_from_collect(collect: dict[str, Any]) -> str | None:
    for doc in collect.get("company_sources") or []:
        if not isinstance(doc, dict):
            continue
        url = str(doc.get("url") or "")
        if "facebook.com" in url.lower():
            return url
    return None
