"""Guard file-backed SQLite OLTP after PG cutover (Wave 3)."""
from __future__ import annotations

import os


def _truthy(name: str) -> bool:
    return os.environ.get(name, "").strip().lower() in {"1", "true", "yes", "on"}


def sqlite_file_access_allowed() -> bool:
    """Explicit test/diagnostic opt-in only."""
    return _truthy("PTT_ALLOW_SQLITE_TESTS")


def assert_sqlite_file_allowed(*, purpose: str) -> None:
    if sqlite_file_access_allowed():
        return
    raise RuntimeError(
        f"SQLite file access is disabled ({purpose}); set PTT_ALLOW_SQLITE_TESTS=1 for tests only"
    )
