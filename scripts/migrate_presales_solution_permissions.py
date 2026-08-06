#!/usr/bin/env python3
"""Apply P3-S2 crm_presales_solution default grants (INSERT OR IGNORE)."""
from __future__ import annotations

import sqlite3
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from admin_page_permissions import migrate_presales_solution_permissions  # noqa: E402


def main() -> int:
    db_path = ROOT / "data" / "crm.db"
    if not db_path.is_file():
        print(f"Missing {db_path}", file=sys.stderr)
        return 1
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    try:
        migrate_presales_solution_permissions(conn)
        conn.commit()
        print("OK  migrate_presales_solution_permissions")
        return 0
    finally:
        conn.close()


if __name__ == "__main__":
    raise SystemExit(main())
