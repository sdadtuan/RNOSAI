"""Tests for LMP Discover cache (Phase 3)."""
from __future__ import annotations

import os
from unittest.mock import patch

from ptt_crm.lead_meeting_prep import discover


def test_discover_cache_key_phone():
    assert discover.discover_cache_key({"phone": "0909123456", "email": ""}) == "discover:phone:909123456"


def test_discover_cache_key_email_when_no_phone():
    assert discover.discover_cache_key({"phone": "", "email": "Sales@Corp.VN"}) == "discover:email:sales@corp.vn"


def test_discover_cache_key_none_without_contact():
    assert discover.discover_cache_key({"phone": "", "email": ""}) is None


@patch("ptt_crm.lead_meeting_prep.discover.repository.get_domain_cache")
@patch("ptt_crm.lead_meeting_prep.discover.search_identity", return_value=([], [], 0))
@patch("ptt_crm.lead_meeting_prep.discover.parse_discover_llm")
def test_run_discover_uses_cache(mock_parse, mock_search, mock_get_cache):
    cached_result = {
        "discover_status": "found_single",
        "candidates": [{"candidate_id": "c1", "company_name": "Cached Co"}],
        "meta": {"discovered_at": "2026-08-28T10:00:00Z"},
    }
    mock_get_cache.return_value = {"discover_result": cached_result, "credits_used": 2}

    inp = {"lead_id": 1, "phone": "0901234567", "email": "", "full_name": "Test"}
    result, credits = discover.run_discover(inp, {})

    assert result["discover_status"] == "found_single"
    assert result["meta"]["cache_hit"] is True
    assert credits == 2
    mock_parse.assert_not_called()
    mock_search.assert_not_called()


@patch.dict(os.environ, {"TAVILY_API_KEY": "test-key"})
@patch("ptt_crm.lead_meeting_prep.discover.repository.upsert_domain_cache")
@patch("ptt_crm.lead_meeting_prep.discover.repository.get_domain_cache", return_value=None)
@patch(
    "ptt_crm.lead_meeting_prep.discover.search_identity",
    return_value=([{"url": "https://masothue.com/1", "content": "Cty Fresh Co"}], ["q"], 1),
)
@patch("ptt_crm.lead_meeting_prep.discover.parse_discover_llm")
def test_run_discover_stores_cache_on_hit(mock_parse, mock_search, mock_get_cache, mock_upsert):
    mock_parse.return_value = {
        "discover_status": "found_single",
        "candidates": [{"candidate_id": "c1", "company_name": "Fresh Co", "source_url": "https://x.vn"}],
        "meta": {"discovered_at": "2026-08-28T10:00:00Z"},
    }

    inp = {"lead_id": 2, "phone": "0909999888", "email": "", "full_name": "Test"}
    discover.run_discover(inp, {})

    mock_upsert.assert_called_once()
    cache_key = mock_upsert.call_args[0][0]
    assert cache_key.startswith("discover:phone:")


@patch("ptt_crm.lead_meeting_prep.discover.repository.upsert_domain_cache")
@patch("ptt_crm.lead_meeting_prep.discover.repository.get_domain_cache", return_value=None)
@patch("ptt_crm.lead_meeting_prep.discover.search_identity", return_value=([], [], 0))
@patch("ptt_crm.lead_meeting_prep.discover.build_stub_discover")
def test_run_discover_skips_cache_for_not_found(mock_stub, mock_search, mock_get_cache, mock_upsert):
    mock_stub.return_value = {
        "discover_status": "not_found",
        "candidates": [],
        "meta": {"discovered_at": "2026-08-28T10:00:00Z"},
        "query_context": {"tavily_queries": []},
        "discover_message_vi": "Không tìm thấy",
        "am_action": "enter_company_manual",
    }

    inp = {"lead_id": 3, "phone": "0901111222", "email": "", "full_name": "Test"}
    discover.run_discover(inp, {})

    mock_upsert.assert_not_called()
