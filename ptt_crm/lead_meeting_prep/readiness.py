"""Close readiness score — rule-based (S-LMP-1)."""
from __future__ import annotations

from typing import Any


def compute_readiness_score(inp: dict[str, Any], collect: dict[str, Any]) -> int:
    score = 35
    if inp.get("phone") or inp.get("email"):
        score += 15
    if inp.get("company_name"):
        score += 20
    if inp.get("industry"):
        score += 10
    if inp.get("problem"):
        score += 10
    if collect.get("company_found") and not collect.get("stub"):
        score += 10
    verified = collect.get("verify_website_confidence")
    if verified == "verified":
        score += 10
    elif verified == "provided":
        score += 5
    return min(100, max(0, score))
