"""Form/API lead ingest — no Flask dependency."""
from __future__ import annotations

import logging
from typing import Any

logger = logging.getLogger(__name__)


def _ingest_lead_from_form_pg(
    *,
    full_name: str,
    phone: str,
    email: str,
    need: str,
    source: str,
    region: str = "",
    product_interest: str = "",
    utm_campaign: str = "",
    re_project_id: int | None = None,
    re_project_code: str | None = None,
    ingest_site: str = "",
) -> int | None:
    from ptt_crm.lead_ingest_pg import process_ingest_lead_payload_pg

    raw: dict[str, Any] = {
        "full_name": full_name,
        "phone": phone,
        "email": email,
        "need": need,
        "source": source,
        "region": region,
        "product_interest": product_interest,
        "utm_campaign": utm_campaign,
    }
    if re_project_id is not None:
        raw["re_project_id"] = re_project_id
    if re_project_code:
        raw["re_project_code"] = re_project_code
    if ingest_site:
        raw["ingest_site"] = ingest_site

    outcome = process_ingest_lead_payload_pg(
        {
            "channel": "website",
            "lead": {
                "channel": "website",
                "raw": raw,
            },
        }
    )
    if not outcome.get("ok"):
        raise ValueError(outcome.get("error") or "PG form ingest failed")
    created_ids = list(outcome.get("created_ids") or [])
    return int(created_ids[0]) if created_ids else None


def ingest_lead_from_form(
    conn: Any,
    *,
    full_name: str,
    phone: str,
    email: str,
    need: str,
    source: str,
    region: str = "",
    product_interest: str = "",
    utm_campaign: str = "",
    re_project_id: int | None = None,
    re_project_code: str | None = None,
    ingest_site: str = "",
    ts: str,
    _from_worker: bool = False,
) -> int | None:
    """Create a CRM lead through the PostgreSQL ingest path only."""
    del conn, ts
    try:
        return _ingest_lead_from_form_pg(
            full_name=full_name,
            phone=phone,
            email=email,
            need=need,
            source=source,
            region=region,
            product_interest=product_interest,
            utm_campaign=utm_campaign,
            re_project_id=re_project_id,
            re_project_code=re_project_code,
            ingest_site=ingest_site,
        )
    except ValueError as exc:
        logger.warning("CRM ingest lead from form failed: %s", exc)
        if not _from_worker:
            _enqueue_form_ingest_failure(
                full_name=full_name,
                phone=phone,
                email=email,
                need=need,
                source=source,
                region=region,
                product_interest=product_interest,
                utm_campaign=utm_campaign,
                re_project_id=re_project_id,
                re_project_code=re_project_code,
                ingest_site=ingest_site,
                error=str(exc),
            )
        return None
    except Exception as exc:
        logger.exception("CRM ingest lead from form error: %s", exc)
        if not _from_worker:
            _enqueue_form_ingest_failure(
                full_name=full_name,
                phone=phone,
                email=email,
                need=need,
                source=source,
                region=region,
                product_interest=product_interest,
                utm_campaign=utm_campaign,
                re_project_id=re_project_id,
                re_project_code=re_project_code,
                ingest_site=ingest_site,
                error=str(exc),
            )
        return None


def _enqueue_form_ingest_failure(**fields: Any) -> None:
    from ptt_jobs.form_ingest_failure import enqueue_form_ingest_failure

    enqueue_form_ingest_failure(**fields)
