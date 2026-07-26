"""RNOS-08 — HTTP client for Nest AI score API (worker consumer)."""
from __future__ import annotations

import json
import logging
import os
import urllib.error
import urllib.request
from typing import Any

logger = logging.getLogger(__name__)


def _crm_api_base_url() -> str:
    return (
        os.environ.get("PTT_CRM_API_URL")
        or os.environ.get("PTT_NEST_LEADS_URL")
        or os.environ.get("CRM_API_URL")
        or "http://127.0.0.1:3000"
    ).rstrip("/")


def _internal_key() -> str:
    return (os.environ.get("PTT_CRM_INTERNAL_KEY") or "").strip()


def score_lead_via_api(
    *,
    lead_id: int,
    correlation_id: str | None = None,
    force: bool = False,
    timeout_sec: float = 15.0,
) -> dict[str, Any]:
    """
    POST /api/v1/ai/score/lead with internal key (RNOS-04 rules engine).

    Returns { ok: True, data: ... } or { ok: False, error: ... }.
    """
    key = _internal_key()
    if not key:
        return {"ok": False, "error": "missing_internal_key", "skipped": True}

    body = {"lead_id": int(lead_id)}
    if force:
        body["force"] = True

    headers = {
        "Content-Type": "application/json",
        "x-ptt-internal-key": key,
    }
    if correlation_id:
        headers["x-correlation-id"] = correlation_id

    req = urllib.request.Request(
        f"{_crm_api_base_url()}/api/v1/ai/score/lead",
        data=json.dumps(body).encode("utf-8"),
        headers=headers,
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=timeout_sec) as resp:
            raw = resp.read().decode("utf-8")
            parsed = json.loads(raw) if raw else {}
            return {"ok": True, "status": resp.status, "body": parsed}
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        logger.warning(
            "score_lead API HTTP %s lead_id=%s body=%s",
            exc.code,
            lead_id,
            detail[:500],
        )
        return {"ok": False, "error": f"http_{exc.code}", "detail": detail[:1000]}
    except Exception as exc:
        logger.warning("score_lead API failed lead_id=%s: %s", lead_id, exc)
        return {"ok": False, "error": str(exc)}


def pipeline_risk_scan_via_api(
    *,
    limit: int | None = None,
    correlation_id: str | None = None,
    timeout_sec: float = 60.0,
) -> dict[str, Any]:
    """
    POST /api/v1/ai/pipeline-risk/scan with internal key (RNOS-23 daily scan).

    Returns { ok: True, data: ... } or { ok: False, error: ... }.
    """
    key = _internal_key()
    if not key:
        return {"ok": False, "error": "missing_internal_key", "skipped": True}

    body: dict[str, Any] = {}
    if limit is not None:
        body["limit"] = int(limit)

    headers = {
        "Content-Type": "application/json",
        "x-ptt-internal-key": key,
    }
    if correlation_id:
        headers["x-correlation-id"] = correlation_id

    req = urllib.request.Request(
        f"{_crm_api_base_url()}/api/v1/ai/pipeline-risk/scan",
        data=json.dumps(body).encode("utf-8"),
        headers=headers,
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=timeout_sec) as resp:
            raw = resp.read().decode("utf-8")
            parsed = json.loads(raw) if raw else {}
            return {"ok": True, "status": resp.status, "body": parsed}
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        logger.warning(
            "pipeline_risk_scan API HTTP %s body=%s",
            exc.code,
            detail[:500],
        )
        return {"ok": False, "error": f"http_{exc.code}", "detail": detail[:1000]}
    except Exception as exc:
        logger.warning("pipeline_risk_scan API failed: %s", exc)
        return {"ok": False, "error": str(exc)}


def forecast_snapshot_via_api(
    *,
    force: bool = False,
    snapshot_date: str | None = None,
    correlation_id: str | None = None,
    timeout_sec: float = 60.0,
) -> dict[str, Any]:
    """
    POST /api/v1/ai/forecast with internal key (RNOS-17 daily snapshot).

    Returns { ok: True, data: ... } or { ok: False, error: ... }.
    """
    key = _internal_key()
    if not key:
        return {"ok": False, "error": "missing_internal_key", "skipped": True}

    body: dict[str, Any] = {}
    if force:
        body["force"] = True
    if snapshot_date:
        body["snapshot_date"] = snapshot_date

    headers = {
        "Content-Type": "application/json",
        "x-ptt-internal-key": key,
    }
    if correlation_id:
        headers["x-correlation-id"] = correlation_id

    req = urllib.request.Request(
        f"{_crm_api_base_url()}/api/v1/ai/forecast",
        data=json.dumps(body).encode("utf-8"),
        headers=headers,
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=timeout_sec) as resp:
            raw = resp.read().decode("utf-8")
            parsed = json.loads(raw) if raw else {}
            return {"ok": True, "status": resp.status, "body": parsed}
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        logger.warning(
            "forecast_snapshot API HTTP %s body=%s",
            exc.code,
            detail[:500],
        )
        return {"ok": False, "error": f"http_{exc.code}", "detail": detail[:1000]}
    except Exception as exc:
        logger.warning("forecast_snapshot API failed: %s", exc)
        return {"ok": False, "error": str(exc)}
