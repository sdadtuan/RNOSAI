"""PrepResult validation — S-LMP-1b."""
from __future__ import annotations

from typing import Any


class PrepResultValidationError(ValueError):
    pass


def validate_prep_result(
    result: dict[str, Any],
    *,
    allowed_dv_codes: set[str] | None = None,
    prep_stage: str = "m1_first_strike",
) -> dict[str, Any]:
    if not isinstance(result, dict):
        raise PrepResultValidationError("result must be object")

    contact = result.get("contact_profile")
    if not isinstance(contact, dict):
        raise PrepResultValidationError("contact_profile required")
    if contact.get("found") is not False:
        raise PrepResultValidationError("contact_profile.found must be false")

    company = result.get("company_profile")
    if not isinstance(company, dict) or not str(company.get("summary") or "").strip():
        raise PrepResultValidationError("company_profile.summary required")

    script = result.get("consulting_script")
    if not isinstance(script, dict):
        raise PrepResultValidationError("consulting_script required")
    if not str(script.get("opening") or "").strip():
        raise PrepResultValidationError("consulting_script.opening required")

    services = result.get("recommended_services")
    if not isinstance(services, list) or not (1 <= len(services) <= 3):
        raise PrepResultValidationError("recommended_services must have 1..3 items")

    for idx, svc in enumerate(services, start=1):
        if not isinstance(svc, dict):
            raise PrepResultValidationError("recommended_services item invalid")
        code = str(svc.get("dv_code") or "").upper()
        if allowed_dv_codes and code and code not in allowed_dv_codes:
            raise PrepResultValidationError(f"invalid dv_code {code}")
        if not str(svc.get("name_vi") or "").strip():
            raise PrepResultValidationError("recommended_services.name_vi required")
        if svc.get("priority") != idx:
            svc["priority"] = idx

    meta = result.get("meta")
    if not isinstance(meta, dict):
        raise PrepResultValidationError("meta required")
    if not str(meta.get("prompt_version") or "").strip():
        raise PrepResultValidationError("meta.prompt_version required")
    meta["prep_stage"] = prep_stage

    result["contact_profile"] = {
        "found": False,
        "summary": str(contact.get("summary") or "Không research profile cá nhân liên hệ (policy)."),
        "facts": [],
    }
    if "social_channels" not in result or not isinstance(result["social_channels"], list):
        result["social_channels"] = []

    return result


def enforce_contact_policy(result: dict[str, Any]) -> dict[str, Any]:
    result["contact_profile"] = {
        "found": False,
        "summary": "Không research profile cá nhân liên hệ (policy).",
        "facts": [],
    }
    return result
