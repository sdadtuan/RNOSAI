"""Tests for LMP Discover v1 schema and helpers."""
from __future__ import annotations

import pytest

from ptt_crm.lead_meeting_prep import discover
from ptt_crm.lead_meeting_prep.discover_schema import (
    DiscoverValidationError,
    validate_discover_result,
)


def test_validate_not_found_empty_candidates():
    out = validate_discover_result(
        {
            "discover_status": "not_found",
            "discover_message_vi": "Không tìm thấy",
            "query_context": {
                "lead_phone_normalized": "912345678",
                "lead_email_normalized": None,
                "tavily_queries": ['site:masothue.com "0912345678"'],
                "tier1_hints_used": [],
            },
            "candidates": [],
            "recommended_candidate_id": None,
            "am_action": "enter_company_manual",
            "meta": {
                "discovered_at": "2026-08-28T10:00:00Z",
                "sources_parsed": 1,
                "model": "test",
                "prompt_version": "lmp-discover-v1",
            },
        },
        tavily_urls=set(),
        lead_phone="0912345678",
    )
    assert out["discover_status"] == "not_found"
    assert out["candidates"] == []


def test_validate_found_single_from_candidates():
    url = "https://masothue.com/123"
    out = validate_discover_result(
        {
            "discover_status": "found_single",
            "discover_message_vi": "OK",
            "query_context": {
                "lead_phone_normalized": "912345678",
                "lead_email_normalized": None,
                "tavily_queries": [],
                "tier1_hints_used": [],
            },
            "candidates": [
                {
                    "candidate_id": "abc123456789",
                    "company_name": "Cty ABC",
                    "website_url": "https://abc.vn",
                    "social_urls": [],
                    "tax_id": None,
                    "address_vi": None,
                    "industry_hint": None,
                    "phones_on_record": ["0912345678"],
                    "emails_on_record": [],
                    "source_url": url,
                    "source_type": "masothue",
                    "confidence": "likely",
                    "match_signals": ["phone_match"],
                    "note_vi": None,
                }
            ],
            "recommended_candidate_id": "abc123456789",
            "am_action": "none",
            "meta": {
                "discovered_at": "2026-08-28T10:00:00Z",
                "sources_parsed": 1,
                "model": "test",
                "prompt_version": "lmp-discover-v1",
            },
        },
        tavily_urls={url},
        lead_phone="0912345678",
    )
    assert out["discover_status"] == "found_single"
    assert out["candidates"][0]["confidence"] == "verified"


def test_build_tavily_queries_never_uses_full_name():
    queries = discover.build_tavily_queries(
        {"phone": "0912345678", "email": "", "full_name": "Nguyen Van A"}
    )
    assert queries
    assert all("Nguyen" not in q for q in queries)


def test_apply_candidate_to_input():
    discover_result = {
        "candidates": [
            {
                "candidate_id": "c1",
                "company_name": "Cty XYZ",
                "website_url": "https://xyz.vn",
                "social_urls": [],
            }
        ]
    }
    inp = {"lead_id": 1, "phone": "0900", "company_name": ""}
    out = discover.apply_candidate_to_input(inp, discover_result, "c1")
    assert out["company_name"] == "Cty XYZ"
    assert out["website_url"] == "https://xyz.vn"


def test_invalid_status_raises():
    with pytest.raises(DiscoverValidationError):
        validate_discover_result(
            {"discover_status": "bogus"},
            tavily_urls=set(),
        )
