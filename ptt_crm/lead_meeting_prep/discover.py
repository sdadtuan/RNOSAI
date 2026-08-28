"""LMP Discover v1 — Tavily identity search + LLM parse (Phase 1)."""
from __future__ import annotations

import json
import logging
import os
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

from ptt_crm.lead_meeting_prep import collect, discover_schema
from ptt_crm.lead_meeting_prep.tier1_hints import company_hint_from_email
from ptt_crm.lead_meeting_prep.verify import normalize_email, normalize_phone
from ptt_crm import lmp_llm_client

logger = logging.getLogger(__name__)

PROMPT_VERSION = "lmp-discover-v1"
ROOT = Path(__file__).resolve().parents[2]
MAX_DOCS = 8
MAX_CONTENT = 4000

_FREE_EMAIL_DOMAINS = frozenset(
    {
        "gmail.com",
        "googlemail.com",
        "yahoo.com",
        "yahoo.com.vn",
        "hotmail.com",
        "outlook.com",
        "live.com",
        "icloud.com",
        "me.com",
        "proton.me",
        "protonmail.com",
    }
)


def _load_system_prompt() -> str:
    path = ROOT / "docs" / "prompts" / "lmp" / "lmp-discover-v1.system.md"
    if path.is_file():
        return path.read_text(encoding="utf-8")
    return "Return DiscoverResult JSON for business identity discovery."


def _phone_query_token(phone: str) -> str:
    digits = re.sub(r"\D", "", str(phone or ""))
    if digits.startswith("84") and len(digits) >= 10:
        digits = "0" + digits[2:]
    return digits


def build_tavily_queries(inp: dict[str, Any]) -> list[str]:
    """Build identity search queries — never include contact full_name."""
    queries: list[str] = []
    phone = _phone_query_token(inp.get("phone"))
    email = normalize_email(inp.get("email"))

    if phone:
        queries.extend(
            [
                f'site:masothue.com "{phone}"',
                f'site:thongtincongty.vn "{phone}"',
                f'"{phone}" công ty',
            ]
        )
    if email:
        queries.append(f'"{email}"')
        if "@" in email:
            domain = email.split("@", 1)[1]
            if domain and domain not in _FREE_EMAIL_DOMAINS:
                queries.append(f'site:masothue.com "{email}"')

    return list(dict.fromkeys(q for q in queries if q))[:6]


def build_tier1_hints(inp: dict[str, Any], meta: dict[str, Any] | None = None) -> dict[str, Any]:
    meta = meta if isinstance(meta, dict) else {}
    hints: dict[str, Any] = {}
    used: list[str] = []

    email = normalize_email(inp.get("email"))
    if email and "@" in email:
        domain = email.split("@", 1)[1]
        if domain and domain not in _FREE_EMAIL_DOMAINS:
            hints["email_domain"] = domain
            used.append("email_domain")
            email_hint = company_hint_from_email(email)
            if email_hint.get("website_url"):
                hints["website_url"] = email_hint["website_url"]
            if email_hint.get("company_name"):
                hints.setdefault("meta_company_name", email_hint["company_name"])

    if inp.get("website_url"):
        hints["website_url"] = str(inp["website_url"])
        used.append("provided_website")
    if meta.get("company_name"):
        hints["meta_company_name"] = str(meta["company_name"])
        used.append("meta_company_field")
    if meta.get("page_name") or meta.get("facebook_page_name"):
        hints["meta_page_name"] = str(meta.get("page_name") or meta.get("facebook_page_name"))
        used.append("meta_page")
    if inp.get("social_urls"):
        parts = [p.strip() for p in str(inp["social_urls"]).split(",") if p.strip()]
        if parts:
            hints["social_urls"] = parts[:3]

    hints["_used"] = used
    return hints


def search_identity(inp: dict[str, Any]) -> tuple[list[dict[str, Any]], list[str], int]:
    api_key = (os.environ.get("TAVILY_API_KEY") or "").strip()
    queries = build_tavily_queries(inp)
    if not api_key or not queries:
        return [], queries, 0

    credits = 0
    docs: list[dict[str, Any]] = []
    seen: set[str] = set()
    limit = max(1, int(os.environ.get("MAX_TAVILY_CREDITS_PER_LEAD", "8") or 8))

    for query in queries:
        if credits >= limit or len(docs) >= MAX_DOCS:
            break
        try:
            batch, cost = collect._search(query, api_key=api_key, max_results=3)
            credits += cost
            for doc in batch:
                url = str(doc.get("url") or "")
                if url and url not in seen:
                    seen.add(url)
                    trimmed = dict(doc)
                    trimmed["content"] = str(doc.get("content") or "")[:MAX_CONTENT]
                    docs.append(trimmed)
        except Exception as exc:
            logger.warning("discover Tavily search failed query=%s: %s", query[:80], exc)

    return docs[:MAX_DOCS], queries, credits


def build_user_prompt(
    inp: dict[str, Any],
    *,
    tier1_hints: dict[str, Any],
    tavily_docs: list[dict[str, Any]],
    tavily_queries: list[str],
) -> str:
    payload = {
        "lead_id": inp.get("lead_id"),
        "full_name": inp.get("full_name"),
        "phone": inp.get("phone"),
        "email": inp.get("email"),
        "tier1_hints": {k: v for k, v in tier1_hints.items() if not k.startswith("_")},
        "tavily_docs": tavily_docs,
        "tavily_queries": tavily_queries,
    }
    return json.dumps(payload, ensure_ascii=False, indent=2)


def build_stub_discover(
    inp: dict[str, Any],
    *,
    tier1_hints: dict[str, Any],
    tavily_docs: list[dict[str, Any]],
    tavily_queries: list[str],
    reason: str,
) -> dict[str, Any]:
    candidates: list[dict[str, Any]] = []
    company = str(tier1_hints.get("meta_company_name") or "").strip()
    website = tier1_hints.get("website_url")
    if not company:
        email_hint = company_hint_from_email(str(inp.get("email") or ""))
        company = str(email_hint.get("company_name") or "").strip()
        website = website or email_hint.get("website_url")

    if company and len(company) >= 2:
        socials = tier1_hints.get("social_urls") or []
        source_url = str(website or (socials[0] if socials else "") or "https://email-domain.local")
        cand_id = discover_schema.stable_candidate_id(company, source_url)
        candidates.append(
            {
                "candidate_id": cand_id,
                "company_name": company,
                "website_url": website,
                "social_urls": tier1_hints.get("social_urls") or [],
                "tax_id": None,
                "address_vi": None,
                "industry_hint": None,
                "phones_on_record": [normalize_phone(inp.get("phone"))] if inp.get("phone") else [],
                "emails_on_record": [normalize_email(inp.get("email"))] if inp.get("email") else [],
                "source_url": source_url,
                "source_type": "email_domain" if tier1_hints.get("email_domain") else "meta_page",
                "confidence": "weak",
                "match_signals": ["domain_match"],
                "note_vi": f"Gợi ý Tier-1 ({reason})",
            }
        )
        status = "tier1_only"
        am_action = "enter_company_manual"
        message = f"Gợi ý từ email/trang Meta: {company}. Xác nhận hoặc sửa trước khi prep."
    else:
        status = "not_found"
        am_action = "enter_company_manual"
        message = "Không tìm thấy DN công khai từ SĐT/email. Nhập tên công ty để tiếp tục."

    return {
        "discover_status": status,
        "discover_message_vi": message,
        "query_context": {
            "lead_phone_normalized": normalize_phone(inp.get("phone")) or None,
            "lead_email_normalized": normalize_email(inp.get("email")) or None,
            "tavily_queries": tavily_queries,
            "tier1_hints_used": list(tier1_hints.get("_used") or []),
        },
        "candidates": candidates,
        "recommended_candidate_id": candidates[0]["candidate_id"] if len(candidates) == 1 else None,
        "am_action": am_action,
        "meta": {
            "discovered_at": datetime.now(timezone.utc).isoformat(),
            "sources_parsed": len(tavily_docs),
            "model": "stub",
            "prompt_version": PROMPT_VERSION,
            "stub_reason": reason,
        },
    }


def parse_discover_llm(
    inp: dict[str, Any],
    *,
    tier1_hints: dict[str, Any],
    tavily_docs: list[dict[str, Any]],
    tavily_queries: list[str],
    correlation_id: str | None = None,
) -> dict[str, Any]:
    tavily_urls = {str(d.get("url") or "") for d in tavily_docs if d.get("url")}
    stub = build_stub_discover(
        inp,
        tier1_hints=tier1_hints,
        tavily_docs=tavily_docs,
        tavily_queries=tavily_queries,
        reason="llm_fallback",
    )

    llm_out = lmp_llm_client.complete_discover(
        lead_id=int(inp.get("lead_id") or 0),
        client_id=str(inp.get("client_id") or "") or None,
        system_prompt=_load_system_prompt(),
        user_prompt=build_user_prompt(
            inp,
            tier1_hints=tier1_hints,
            tavily_docs=tavily_docs,
            tavily_queries=tavily_queries,
        ),
        prompt_version=PROMPT_VERSION,
        prep_stage="m1_first_strike",
        stub_json=lambda: stub,
        correlation_id=correlation_id,
    )

    parsed = llm_out.get("parsed") if isinstance(llm_out.get("parsed"), dict) else stub
    try:
        return discover_schema.validate_discover_result(
            parsed,
            tavily_urls=tavily_urls,
            lead_phone=str(inp.get("phone") or ""),
            lead_email=str(inp.get("email") or ""),
            full_name=str(inp.get("full_name") or ""),
        )
    except discover_schema.DiscoverValidationError as exc:
        logger.warning("discover validation failed: %s", exc)
        return discover_schema.validate_discover_result(
            stub,
            tavily_urls=tavily_urls,
            lead_phone=str(inp.get("phone") or ""),
            lead_email=str(inp.get("email") or ""),
            full_name=str(inp.get("full_name") or ""),
        )


def run_discover(
    inp: dict[str, Any],
    meta: dict[str, Any] | None = None,
    *,
    correlation_id: str | None = None,
) -> tuple[dict[str, Any], int]:
    tier1_hints = build_tier1_hints(inp, meta)
    docs, queries, credits = search_identity(inp)

    if not docs and not (os.environ.get("TAVILY_API_KEY") or "").strip():
        result = build_stub_discover(
            inp,
            tier1_hints=tier1_hints,
            tavily_docs=[],
            tavily_queries=queries,
            reason="TAVILY_API_KEY missing",
        )
        validated = discover_schema.validate_discover_result(
            result,
            tavily_urls=set(),
            lead_phone=str(inp.get("phone") or ""),
            lead_email=str(inp.get("email") or ""),
            full_name=str(inp.get("full_name") or ""),
        )
        return validated, credits

    result = parse_discover_llm(
        inp,
        tier1_hints=tier1_hints,
        tavily_docs=docs,
        tavily_queries=queries,
        correlation_id=correlation_id,
    )
    result["meta"]["sources_parsed"] = len(docs)
    return result, credits


def candidate_by_id(discover_result: dict[str, Any], candidate_id: str) -> dict[str, Any] | None:
    for cand in discover_result.get("candidates") or []:
        if isinstance(cand, dict) and str(cand.get("candidate_id")) == candidate_id:
            return cand
    return None


def apply_candidate_to_input(inp: dict[str, Any], discover_result: dict[str, Any], candidate_id: str) -> dict[str, Any]:
    cand = candidate_by_id(discover_result, candidate_id)
    if not cand:
        rec = discover_result.get("recommended_candidate_id")
        if rec:
            cand = candidate_by_id(discover_result, str(rec))
    if not cand:
        return dict(inp)

    out = dict(inp)
    out["company_name"] = str(cand.get("company_name") or out.get("company_name") or "")
    if cand.get("website_url"):
        out["website_url"] = str(cand["website_url"])
    socials = cand.get("social_urls") or []
    if socials and not out.get("social_urls"):
        out["social_urls"] = ",".join(str(s) for s in socials[:3])
    return out


def discover_meta_patch(
    discover_result: dict[str, Any],
    candidate_id: str,
    *,
    confirmed_by_am: bool = False,
    discover_source: str = "auto",
    confirmed_by: str | None = None,
) -> dict[str, Any]:
    cand = candidate_by_id(discover_result, candidate_id)
    if not cand:
        return {}
    lmp_discover: dict[str, Any] = {
        "candidate_id": candidate_id,
        "source_url": cand.get("source_url") or cand.get("website_url"),
        "discovered_at": (discover_result.get("meta") or {}).get("discovered_at"),
        "discover_status": discover_result.get("discover_status"),
        "discover_source": "am_confirmed" if confirmed_by_am else discover_source,
        "confirmed_by_am": confirmed_by_am,
    }
    if confirmed_by:
        lmp_discover["confirmed_by"] = confirmed_by
    return {
        "company_name": cand.get("company_name"),
        "website_url": cand.get("website_url"),
        "lmp_discover": lmp_discover,
    }


def am_manual_meta_patch(
    company_name: str,
    website_url: str | None = None,
    *,
    confirmed_by: str | None = None,
) -> dict[str, Any]:
    now = datetime.now(timezone.utc).isoformat()
    lmp_discover: dict[str, Any] = {
        "candidate_id": None,
        "source_url": website_url,
        "discovered_at": now,
        "discover_status": "am_manual",
        "discover_source": "am_manual",
        "confirmed_by_am": True,
    }
    if confirmed_by:
        lmp_discover["confirmed_by"] = confirmed_by
    patch: dict[str, Any] = {
        "company_name": company_name,
        "lmp_discover": lmp_discover,
    }
    if website_url:
        patch["website_url"] = website_url
    return patch


def to_entity_candidates(discover_result: dict[str, Any]) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for cand in discover_result.get("candidates") or []:
        if not isinstance(cand, dict):
            continue
        url = str(cand.get("website_url") or cand.get("source_url") or "")
        label = str(cand.get("company_name") or urlparse(url).netloc or url)
        phones = cand.get("phones_on_record") or []
        out.append(
            {
                "id": str(cand.get("candidate_id")),
                "url": url or str(cand.get("source_url") or ""),
                "label": label,
                "phone": phones[0] if phones else None,
                "region_hint": cand.get("address_vi"),
                "confidence": cand.get("confidence"),
                "source_type": cand.get("source_type"),
                "note_vi": cand.get("note_vi"),
            }
        )
    return out
