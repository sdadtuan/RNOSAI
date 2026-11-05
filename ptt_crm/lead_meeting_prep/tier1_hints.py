"""Phase 0 — tier-1 LMP hints (email domain, form/meta field picks)."""
from __future__ import annotations

import re
from typing import Any

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
        "ymail.com",
        "mail.ru",
        "zoho.com",
    }
)


def _title_words(raw: str) -> str:
    parts = re.split(r"[\s_-]+", raw.strip())
    return " ".join(w[:1].upper() + w[1:].lower() if w else "" for w in parts if w)


def company_hint_from_email(email: str) -> dict[str, str]:
    at = email.find("@")
    if at < 0:
        return {}
    domain = email[at + 1 :].strip().lower().removeprefix("www.")
    if not domain or domain in _FREE_EMAIL_DOMAINS:
        return {}
    label = domain.split(".")[0] if domain else ""
    if len(label) < 2:
        return {}
    return {
        "website_url": f"https://{domain}",
        "company_name": _title_words(label),
    }


def _pick(meta: dict[str, Any], *keys: str) -> str:
    for key in keys:
        val = meta.get(key)
        if val is not None and str(val).strip():
            return str(val).strip()
    return ""


def enrich_lead_meta_for_lmp(
    meta: dict[str, Any],
    *,
    phone: str = "",
    email: str = "",
    item: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Merge company/website hints into lead meta at ingest time."""
    out = dict(meta)
    item = item or {}

    if not _pick(out, "company_name", "company"):
        for src in (
            item.get("company_name"),
            item.get("company"),
            item.get("business_name"),
        ):
            if src and str(src).strip():
                out["company_name"] = str(src).strip()
                break

    if not _pick(out, "website_url", "website", "domain"):
        for src in (item.get("website_url"), item.get("website"), item.get("domain")):
            if src and str(src).strip():
                out["website_url"] = str(src).strip()
                break

    raw_fields = out.get("raw_field_data")
    if isinstance(raw_fields, dict):
        if not _pick(out, "company_name", "company"):
            company = _pick(raw_fields, "company_name", "company", "business_name", "ten_cong_ty", "cong_ty")
            if company:
                out["company_name"] = company
        if not _pick(out, "website_url", "website", "domain"):
            website = _pick(raw_fields, "website_url", "website", "domain", "trang_web")
            if website:
                out["website_url"] = website

    email_norm = str(email or item.get("email") or out.get("email") or "").strip().lower()
    if email_norm:
        hints = company_hint_from_email(email_norm)
        if hints.get("company_name") and not _pick(out, "company_name", "company"):
            out["company_name"] = hints["company_name"]
            out.setdefault("lmp_hint_sources", {})["company_name"] = "email_domain"
        if hints.get("website_url") and not _pick(out, "website_url", "website", "domain"):
            out["website_url"] = hints["website_url"]
            out.setdefault("lmp_hint_sources", {})["website_url"] = "email_domain"

    return out
