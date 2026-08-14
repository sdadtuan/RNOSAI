"""Whisper ingest — excerpts only. Never persist raw transcript or audio_uri."""
from __future__ import annotations

import json
import logging
import os
import re
from typing import Any

from ptt_crm.market_research import repository

logger = logging.getLogger(__name__)

MAX_EXCERPT = 500
MAX_EXCERPTS = 12
CHUNK_CHARS = 400
SECONDS_PER_CHUNK = 30


class WhisperDisabled(Exception):
    code = "whisper_disabled"


def excerpts_from_transcript(text: str) -> list[dict[str, str]]:
    raw = str(text or "").strip()
    if not raw:
        return []
    chunks = [part.strip() for part in re.split(r"(?<=[.?!])\s+", raw) if part.strip()]
    if len(chunks) <= 1 and len(raw) > MAX_EXCERPT:
        chunks = _split_every(raw, CHUNK_CHARS)
    else:
        expanded: list[str] = []
        for part in chunks:
            if len(part) > MAX_EXCERPT:
                expanded.extend(_split_every(part, CHUNK_CHARS))
            else:
                expanded.append(part)
        chunks = expanded
    out: list[dict[str, str]] = []
    for index, excerpt in enumerate(chunks[:MAX_EXCERPTS]):
        out.append(
            {
                "locator": _format_locator(index * SECONDS_PER_CHUNK),
                "excerpt": excerpt[:MAX_EXCERPT],
            }
        )
    return out


def assert_no_raw_in_payload(payload: Any) -> None:
    if _has_forbidden_raw_key(payload):
        raise ValueError("raw_transcript_forbidden")
    raw = json.dumps(payload)
    if len(raw) > 8000:
        raise ValueError("raw_transcript_forbidden")


def transcribe_audio(path: str) -> str:
    key = (os.environ.get("OPENAI_API_KEY") or os.environ.get("OPENAI_KEY") or "").strip()
    if not key:
        raise WhisperDisabled("whisper_disabled")
    import urllib.error
    import urllib.request

    model = (os.environ.get("OPENAI_WHISPER_MODEL") or "whisper-1").strip()
    boundary = "----whisper" + os.urandom(8).hex()
    filename = os.path.basename(path) or "audio.wav"
    with open(path, "rb") as fh:
        audio = fh.read()
    body = (
        f"--{boundary}\r\nContent-Disposition: form-data; name=\"model\"\r\n\r\n{model}\r\n".encode()
        + (
            f"--{boundary}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"{filename}\"\r\n"
            "Content-Type: application/octet-stream\r\n\r\n"
        ).encode()
        + audio
        + f"\r\n--{boundary}--\r\n".encode()
    )
    req = urllib.request.Request(
        "https://api.openai.com/v1/audio/transcriptions",
        data=body,
        headers={
            "Authorization": f"Bearer {key}",
            "Content-Type": f"multipart/form-data; boundary={boundary}",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            data = json.loads(resp.read().decode())
    except (urllib.error.URLError, TimeoutError, OSError, json.JSONDecodeError, KeyError) as exc:
        raise RuntimeError(f"whisper_failed: {exc}") from exc
    return str(data.get("text") or "")


def process_research_whisper_payload(payload: dict[str, Any]) -> dict[str, Any]:
    project_id = int(payload.get("project_id") or 0)
    study_id = int(payload.get("study_id") or 0)
    run_id = int(payload.get("run_id") or 0)
    temp_path = str(payload.get("temp_path") or "")
    raw_qid = payload.get("question_id")
    try:
        question_id = int(raw_qid) if raw_qid not in (None, "") else None
    except (TypeError, ValueError):
        question_id = None
    empty = {"ok": False, "excerpt_ids": []}
    try:
        if project_id <= 0 or study_id <= 0 or run_id <= 0:
            return {**empty, "error": "invalid_payload"}

        repository.mark_run_running(run_id)
        try:
            text = transcribe_audio(temp_path)
        except WhisperDisabled:
            repository.fail_run(run_id, "whisper_disabled")
            return {"ok": True, "skipped": True, "error": "whisper_disabled", "excerpt_ids": []}

        excerpts = excerpts_from_transcript(text)
        text = ""
        excerpt_ids: list[int] = []
        for row in excerpts:
            inserted = repository.insert_evidence(
                project_id=project_id,
                study_id=study_id,
                question_id=question_id,
                locator=row["locator"],
                excerpt=row["excerpt"],
            )
            if inserted and inserted.get("id"):
                excerpt_ids.append(int(inserted["id"]))
        output = {"excerpt_ids": excerpt_ids}
        assert_no_raw_in_payload(output)
        repository.succeed_run(run_id, credits_used=0, output=output)
        return {"ok": True, "excerpt_ids": excerpt_ids}
    finally:
        _unlink_quiet(temp_path)


def _split_every(text: str, size: int) -> list[str]:
    return [text[i : i + size] for i in range(0, len(text), size) if text[i : i + size].strip()]


def _format_locator(seconds: int) -> str:
    minutes, secs = divmod(int(seconds), 60)
    return f"T-{minutes:02d}:{secs:02d}"


def _has_forbidden_raw_key(value: Any) -> bool:
    if isinstance(value, list):
        return any(_has_forbidden_raw_key(item) for item in value)
    if not isinstance(value, dict):
        return False
    if "transcript" in value or "audio_uri" in value or "raw" in value:
        return True
    return any(_has_forbidden_raw_key(item) for item in value.values())


def _unlink_quiet(temp_path: str) -> None:
    if not temp_path:
        return
    try:
        os.unlink(temp_path)
    except FileNotFoundError:
        return
    except OSError as exc:
        logger.warning("whisper temp unlink failed path=%s: %s", temp_path, exc)
