"""P5 M1 — Whisper ingest: excerpts only, temp file gone, no raw transcript."""
from __future__ import annotations

from unittest.mock import MagicMock, patch


def test_process_unlinks_temp_and_caps_excerpts(monkeypatch, tmp_path):
    from ptt_crm.market_research import whisper_ingest

    audio = tmp_path / "clip.wav"
    audio.write_bytes(b"fake-audio")

    repo = MagicMock()
    ids = {"n": 100}

    def insert_evidence(**kwargs):
        excerpt = kwargs["excerpt"]
        assert len(excerpt) <= 500
        ids["n"] += 1
        return {"id": ids["n"], "excerpt": excerpt, "locator": kwargs["locator"]}

    repo.insert_evidence.side_effect = insert_evidence
    monkeypatch.setattr(whisper_ingest, "repository", repo)
    monkeypatch.setattr(
        whisper_ingest,
        "transcribe_audio",
        lambda _path: "One short line. Two short line. " + ("x" * 20_000),
    )

    out = whisper_ingest.process_research_whisper_payload(
        {
            "project_id": 1,
            "study_id": 2,
            "run_id": 3,
            "temp_path": str(audio),
        }
    )

    assert out["ok"] is True
    assert audio.exists() is False
    assert repo.insert_evidence.call_count >= 1
    for call in repo.insert_evidence.call_args_list:
        excerpt = call.kwargs["excerpt"]
        assert len(excerpt) <= 500
    repo.succeed_run.assert_called_once()
    output = repo.succeed_run.call_args.kwargs["output"]
    assert list(output.keys()) == ["excerpt_ids"]
    assert "transcript" not in output
    called = " ".join(name for name, *_rest in repo.method_calls).lower()
    assert "insight" not in called
    assert "report" not in called


@patch("ptt_jobs.handlers.research_whisper.mark_job_done")
@patch("ptt_jobs.handlers.research_whisper.process_research_whisper_payload")
def test_handler_unlinks_even_when_process_raises(process_mock, done_mock, tmp_path):
    from ptt_jobs.handlers.research_whisper import run_research_whisper_job

    audio = tmp_path / "orphan.wav"
    audio.write_bytes(b"x")
    process_mock.side_effect = RuntimeError("boom")

    run_research_whisper_job(
        {
            "id": "job-whisper-1",
            "payload": {
                "project_id": 1,
                "study_id": 2,
                "run_id": 3,
                "temp_path": str(audio),
            },
        }
    )

    done_mock.assert_called_once_with("job-whisper-1")
    assert audio.exists() is False
