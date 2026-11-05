"""Quotation OS Wave 2 DDL — static contract checks."""
from __future__ import annotations

import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

W2_TABLES = (
    "crm_quote_options",
    "crm_quote_kpis",
    "crm_quote_deliverables",
    "crm_quote_clauses",
    "crm_quote_approvals",
    "crm_quote_approval_steps",
    "crm_quote_publications",
    "crm_quote_view_events",
    "crm_quote_comments",
    "crm_quote_acceptances",
    "crm_quote_rate_cards",
    "crm_quote_cost_cards",
    "crm_quote_catalog_revisions",
)


class TestQtDdlW2(unittest.TestCase):
    def test_ddl_w2_file_exists_with_tables(self) -> None:
        path = ROOT / "docs/specs/2026-09-08-postgresql-ddl-qt-w2.sql"
        self.assertTrue(path.is_file())
        text = path.read_text(encoding="utf-8")
        for table in W2_TABLES:
            self.assertIn(f"CREATE TABLE IF NOT EXISTS {table}", text)
        self.assertIn("ADD COLUMN IF NOT EXISTS publication_id", text)
        self.assertIn("crm_quote_kpis_class_chk", text)
        self.assertIn("crm_quote_step_state_chk", text)
        self.assertIn("option_key", text)

    def test_apply_script_exists(self) -> None:
        path = ROOT / "scripts/apply_pg_ddl_qt_w2.sh"
        self.assertTrue(path.is_file())
        text = path.read_text(encoding="utf-8")
        self.assertIn("set -euo pipefail", text)
        self.assertIn("DATABASE_URL", text)
        self.assertIn("ON_ERROR_STOP=1", text)
        self.assertIn("2026-09-08-postgresql-ddl-qt-w2.sql", text)


if __name__ == "__main__":
    unittest.main()
