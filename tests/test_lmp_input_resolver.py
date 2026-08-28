"""Tests for lead meeting prep input resolver."""
from __future__ import annotations

from ptt_crm.lead_meeting_prep.input_resolver import (
    needs_am_input,
    resolve_input,
    should_skip_auto,
)
from ptt_crm.lead_meeting_prep.tier1_hints import company_hint_from_email, enrich_lead_meta_for_lmp


def test_resolve_input_company_from_meta():
    row = {
        "lead_id": 1,
        "full_name": "A",
        "phone": "0900",
        "email": "",
        "meta_json": {"company_name": "Cty ABC"},
        "is_duplicate": False,
    }
    inp, sources, skip = resolve_input(row)
    assert skip is None
    assert inp["company_name"] == "Cty ABC"
    assert sources["company_name"] == "meta_json"


def test_resolve_input_missing_company_needs_am_not_skip():
    row = {
        "lead_id": 2,
        "full_name": "A",
        "phone": "0900",
        "email": "",
        "meta_json": {},
        "is_duplicate": False,
    }
    inp, _, skip = resolve_input(row)
    assert skip is None
    assert needs_am_input(inp) == "missing_company_name"


def test_resolve_input_corporate_email_hint():
    row = {
        "lead_id": 3,
        "full_name": "A",
        "phone": "",
        "email": "hi@acmecorp.vn",
        "meta_json": {},
        "is_duplicate": False,
    }
    inp, sources, skip = resolve_input(row)
    assert skip is None
    assert inp["company_name"] == "Acmecorp"
    assert inp["website_url"] == "https://acmecorp.vn"
    assert sources["company_name"] == "email_domain"


def test_resolve_input_missing_contact():
    row = {
        "lead_id": 4,
        "full_name": "A",
        "phone": "",
        "email": "",
        "meta_json": {},
        "is_duplicate": False,
    }
    _, _, skip = resolve_input(row)
    assert skip == "missing_contact"


def test_should_skip_duplicate():
    row = {"is_duplicate": True, "meta_json": {}}
    assert should_skip_auto(row) == "duplicate_lead"


def test_company_hint_from_email_ignores_gmail():
    assert company_hint_from_email("a@gmail.com") == {}


def test_enrich_lead_meta_from_raw_field_data():
    meta = {"raw_field_data": {"company_name": "Cty FB", "website": "acme.vn"}}
    out = enrich_lead_meta_for_lmp(meta, email="x@gmail.com")
    assert out["company_name"] == "Cty FB"
    assert out["website_url"] == "acme.vn"
