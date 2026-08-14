"""BR-RES-11 — strip CRM PII from Tavily queries (phone/email only)."""
from __future__ import annotations

import re

_EMAIL_RE = re.compile(r"\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b")
# VN mobile / landline and generic intl: 8–15 digits with optional + and separators.
_PHONE_RE = re.compile(
    r"(?<!\w)(?:\+?84|0)?[\s.\-]*(?:\d[\s.\-]*){8,14}\d(?!\w)"
)


def strip_pii(text: str) -> str:
    cleaned = _EMAIL_RE.sub(" ", str(text or ""))
    cleaned = _PHONE_RE.sub(" ", cleaned)
    return " ".join(cleaned.split())
