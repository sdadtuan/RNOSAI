"""Quotation OS Wave 3 DDL — static contract checks."""
from __future__ import annotations

import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

W3_TABLES = (
    "crm_quote_import_jobs",
    "crm_quote_esign_attempts",
)


class TestQtDdlW3(unittest.TestCase):
    def test_ddl_w3_file_exists_with_tables(self) -> None:
        path = ROOT / "docs/specs/2026-09-08-postgresql-ddl-qt-w3.sql"
        self.assertTrue(path.is_file())
        text = path.read_text(encoding="utf-8")
        for table in W3_TABLES:
            self.assertIn(f"CREATE TABLE IF NOT EXISTS {table}", text)
        self.assertIn("ADD COLUMN IF NOT EXISTS escalated_at", text)
        self.assertIn("crm_quote_approval_steps", text)
        self.assertIn("DEFAULT 'stub'", text)
        self.assertIn("DEFAULT 'queued'", text)
        self.assertIn("result_json JSONB", text)

    def test_apply_script_exists(self) -> None:
        path = ROOT / "scripts/apply_pg_ddl_qt_w3.sh"
        self.assertTrue(path.is_file())
        text = path.read_text(encoding="utf-8")
        self.assertIn("set -euo pipefail", text)
        self.assertIn("DATABASE_URL", text)
        self.assertIn("ON_ERROR_STOP=1", text)
        self.assertIn("2026-09-08-postgresql-ddl-qt-w3.sql", text)


if __name__ == "__main__":
    unittest.main()
