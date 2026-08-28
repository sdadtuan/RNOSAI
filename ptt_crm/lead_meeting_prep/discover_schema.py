"""DiscoverResult validation — LMP Discover v1."""
from __future__ import annotations

import hashlib
import re
from typing import Any

from ptt_crm.lead_meeting_prep.verify import emails_match, normalize_email, normalize_phone, phones_match

PROMPT_VERSION = "lmp-discover-v1"
VALID_STATUSES = frozenset({"found_single", "found_multiple", "not_found", "tier1_only"})
VALID_AM_ACTIONS = frozenset({"none", "select_candidate", "enter_company_manual"})
VALID_CONFIDENCE = frozenset({"verified", "likely", "weak"})
VALID_SOURCE_TYPES = frozenset(
    {
        "masothue",
        "business_directory",
        "company_website",
        "google_business",
        "meta_page",
        "email_domain",
        "other",
    }
)


class DiscoverValidationError(ValueError):
    pass


def stable_candidate_id(company_name: str, source_url: str) -> str:
    raw = f"{company_name.strip().lower()}|{source_url.strip().lower()}"
    return hashlib.sha1(raw.encode("utf-8")).hexdigest()[:12]


def _normalize_phone_list(values: list[Any]) -> list[str]:
    out: list[str] = []
    seen: set[str] = set()
    for val in values or []:
        norm = normalize_phone(str(val or ""))
        if norm and norm not in seen:
            seen.add(norm)
            out.append(norm)
    return out[:5]


def _normalize_email_list(values: list[Any]) -> list[str]:
    out: list[str] = []
    seen: set[str] = set()
    for val in values or []:
        norm = normalize_email(str(val or ""))
        if norm and norm not in seen:
            seen.add(norm)
            out.append(norm)
    return out[:5]


def _dedupe_candidates(candidates: list[dict[str, Any]]) -> list[dict[str, Any]]:
    merged: dict[str, dict[str, Any]] = {}
    for cand in candidates:
        key = str(cand.get("company_name") or "").strip().lower()
        if not key:
            continue
        existing = merged.get(key)
        if not existing:
            merged[key] = cand
            continue
        rank = {"verified": 0, "likely": 1, "weak": 2}
        if rank.get(str(cand.get("confidence")), 9) < rank.get(str(existing.get("confidence")), 9):
            merged[key] = cand
    return list(merged.values())[:5]


def _bump_confidence(
    cand: dict[str, Any],
    *,
    lead_phone: str,
    lead_email: str,
) -> dict[str, Any]:
    out = dict(cand)
    signals = list(out.get("match_signals") or [])
    phones = _normalize_phone_list(out.get("phones_on_record") or [])
    emails = _normalize_email_list(out.get("emails_on_record") or [])

    if lead_phone and any(phones_match(p, lead_phone) for p in phones):
        if "phone_match" not in signals:
            signals.append("phone_match")
        if out.get("confidence") == "likely":
            out["confidence"] = "verified"
    if lead_email and any(emails_match(e, lead_email) for e in emails):
        if "email_match" not in signals:
            signals.append("email_match")
        if out.get("confidence") in {"likely", "weak"}:
            out["confidence"] = "verified"

    out["match_signals"] = signals[:4]
    out["phones_on_record"] = phones
    out["emails_on_record"] = emails
    return out


def validate_discover_result(
    obj: dict[str, Any],
    *,
    tavily_urls: set[str],
    lead_phone: str = "",
    lead_email: str = "",
    full_name: str = "",
) -> dict[str, Any]:
    if not isinstance(obj, dict):
        raise DiscoverValidationError("discover result must be object")

    status = str(obj.get("discover_status") or "")
    if status not in VALID_STATUSES:
        raise DiscoverValidationError(f"invalid discover_status: {status}")

    meta = obj.get("meta")
    if not isinstance(meta, dict):
        raise DiscoverValidationError("meta required")
    if str(meta.get("prompt_version") or "") != PROMPT_VERSION:
        meta["prompt_version"] = PROMPT_VERSION

    am_action = str(obj.get("am_action") or "")
    if am_action not in VALID_AM_ACTIONS:
        raise DiscoverValidationError(f"invalid am_action: {am_action}")

    raw_candidates = obj.get("candidates")
    if not isinstance(raw_candidates, list):
        raise DiscoverValidationError("candidates must be array")

    cleaned: list[dict[str, Any]] = []
    for raw in raw_candidates:
        if not isinstance(raw, dict):
            continue
        company = str(raw.get("company_name") or "").strip()
        if len(company) < 2:
            continue
        if full_name and company.lower() == str(full_name).strip().lower():
            continue
        source_url = str(raw.get("source_url") or "").strip()
        source_type = str(raw.get("source_type") or "other")
        if source_type not in VALID_SOURCE_TYPES:
            source_type = "other"
        if source_type != "email_domain" and source_url and source_url not in tavily_urls:
            continue
        confidence = str(raw.get("confidence") or "weak")
        if confidence not in VALID_CONFIDENCE:
            confidence = "weak"
        cand_id = str(raw.get("candidate_id") or "").strip() or stable_candidate_id(company, source_url or company)
        if not re.match(r"^[a-z0-9_-]{8,32}$", cand_id):
            cand_id = stable_candidate_id(company, source_url or company)

        cand = {
            "candidate_id": cand_id,
            "company_name": company[:200],
            "website_url": raw.get("website_url"),
            "social_urls": (raw.get("social_urls") or [])[:3],
            "tax_id": raw.get("tax_id"),
            "address_vi": (str(raw.get("address_vi") or "")[:300] or None),
            "industry_hint": (str(raw.get("industry_hint") or "")[:120] or None),
            "phones_on_record": _normalize_phone_list(raw.get("phones_on_record") or []),
            "emails_on_record": _normalize_email_list(raw.get("emails_on_record") or []),
            "source_url": source_url or f"https://{source_type}.local",
            "source_type": source_type,
            "confidence": confidence,
            "match_signals": list(raw.get("match_signals") or ["name_only"])[:4],
            "note_vi": (str(raw.get("note_vi") or "")[:240] or None),
        }
        cleaned.append(_bump_confidence(cand, lead_phone=lead_phone, lead_email=lead_email))

    cleaned = _dedupe_candidates(cleaned)

    if status == "not_found":
        cleaned = []
        am_action = "enter_company_manual"
    elif status == "found_single" and len(cleaned) >= 1:
        cleaned = [sorted(cleaned, key=lambda c: {"verified": 0, "likely": 1, "weak": 2}[c["confidence"]])[0]]
        am_action = "none"
    elif status == "found_multiple" or len(cleaned) >= 2:
        status = "found_multiple"
        am_action = "select_candidate"
    elif status == "tier1_only" and cleaned:
        am_action = obj.get("am_action") if obj.get("am_action") in VALID_AM_ACTIONS else "enter_company_manual"
    elif not cleaned:
        status = "not_found"
        am_action = "enter_company_manual"

    rec = obj.get("recommended_candidate_id")
    if rec and not any(c["candidate_id"] == rec for c in cleaned):
        rec = None
    if status == "found_single" and cleaned and not rec:
        rec = cleaned[0]["candidate_id"]
    if status == "found_multiple":
        rec = None

    message = str(obj.get("discover_message_vi") or "").strip()
    if not message:
        if status == "found_single" and cleaned:
            message = f"Đã xác định doanh nghiệp: {cleaned[0]['company_name']}. Đang research SCI…"
        elif status == "found_multiple":
            message = f"Tìm thấy {len(cleaned)} doanh nghiệp khớp SĐT/email. Chọn đúng pháp nhân."
        elif status == "tier1_only" and cleaned:
            message = f"Gợi ý từ email/trang Meta: {cleaned[0]['company_name']}. Xác nhận hoặc sửa trước khi prep."
        else:
            message = "Không tìm thấy DN công khai từ SĐT/email. Nhập tên công ty để tiếp tục."

    query_context = obj.get("query_context")
    if not isinstance(query_context, dict):
        query_context = {}
    query_context.setdefault("lead_phone_normalized", normalize_phone(lead_phone) or None)
    query_context.setdefault("lead_email_normalized", normalize_email(lead_email) or None)
    query_context.setdefault("tavily_queries", [])
    query_context.setdefault("tier1_hints_used", [])

    return {
        "discover_status": status,
        "discover_message_vi": message[:500],
        "query_context": query_context,
        "candidates": cleaned,
        "recommended_candidate_id": rec,
        "am_action": am_action,
        "meta": meta,
    }
