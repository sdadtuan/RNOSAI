"""P2 M2 — Pulse agent: snapshot signals, no insights, PII-safe Tavily query."""
from __future__ import annotations

from unittest.mock import MagicMock, patch


def test_process_pulse_never_inserts_insight(monkeypatch):
    from ptt_crm.market_research import pulse

    repo = MagicMock()
    repo.load_pulse_context.return_value = {
        "question_vi": "Giá đối thủ đổi thế nào?",
        "geo": ["VN"],
        "product_type": "COMP_LAND",
    }
    repo.list_competitor_snapshot_pairs.return_value = [
        {"prev": {"price": "10", "message": "a"}, "next": {"price": "12", "message": "a"}},
    ]
    repo.insert_trend_signal.return_value = {
        "id": 1,
        "topic": "price",
        "metric": "price",
        "baseline": 10.0,
        "current": 12.0,
        "velocity": 0.2,
        "lifecycle": "rising",
    }
    repo.sum_project_tavily_credits.return_value = 0
    monkeypatch.setattr(pulse, "repository", repo)

    out = pulse.process_research_pulse_payload(
        {"project_id": 1, "question_id": 2, "run_id": 3}
    )

    assert out["ok"] is True
    assert out["insight_ids"] == []
    assert out.get("signals")
    called = " ".join(name for name, *_rest in repo.method_calls).lower()
    assert "insight" not in called
    assert repo.insert_insights.call_count == 0
    repo.succeed_run.assert_called_once()


def test_phone_in_question_does_not_enter_tavily_query(monkeypatch):
    monkeypatch.setenv("TAVILY_API_KEY", "fake-key")
    from ptt_crm.market_research import pulse

    captured: dict[str, str] = {}

    def fake_search(query, **_kwargs):
        captured["query"] = query
        return (
            [{"title": "Trend", "url": "https://example.com/t", "content": "c", "sourceType": "search"}],
            1,
        )

    monkeypatch.setattr(pulse, "_search", fake_search)

    out = pulse.collect_pulse(
        question_vi="Xu hướng trend sữa uống 0909999999?",
        geo=["VN"],
        credits_already_used=0,
    )
    assert "0909999999" not in (out.get("query") or "")
    assert "0909999999" not in captured.get("query", "")


@patch("ptt_jobs.handlers.research_pulse.mark_job_done")
@patch("ptt_jobs.handlers.research_pulse.process_research_pulse_payload")
def test_handler_marks_done_on_collect_fail(process_mock, done_mock):
    from ptt_jobs.handlers.research_pulse import run_research_pulse_job

    process_mock.return_value = {"ok": False, "error": "tavily_search_failed: timeout", "insight_ids": []}
    run_research_pulse_job(
        {
            "id": "job-pulse-1",
            "payload": {"project_id": 1, "question_id": 2, "run_id": 3},
            "attempts": 1,
            "max_attempts": 2,
        }
    )
    done_mock.assert_called_once_with("job-pulse-1")
