"""Tests for PostgreSQL-only form ingest routing."""
from __future__ import annotations

import os
import unittest
from unittest.mock import patch


class TestFormIngestPg(unittest.TestCase):
    @patch.dict(os.environ, {"PTT_LEADS_WRITE_SOURCE": "pg"}, clear=False)
    @patch("ptt_crm.lead_ingest_pg.process_ingest_lead_payload_pg")
    @patch("sqlite3.connect", side_effect=AssertionError("SQLite forbidden"))
    def test_form_ingest_pg_does_not_open_sqlite(
        self,
        mock_connect: unittest.mock.MagicMock,
        mock_pg_ingest: unittest.mock.MagicMock,
    ) -> None:
        from ptt_jobs.handlers.form_ingest import process_form_ingest_payload

        mock_pg_ingest.return_value = {
            "ok": True,
            "created_ids": [42],
            "created_count": 1,
        }

        result = process_form_ingest_payload(
            {
                "full_name": "PG Form Lead",
                "phone": "0901234567",
                "email": "lead@example.com",
                "need": "Demo",
                "source": "website",
                "region": "HCM",
                "product_interest": "CRM",
                "utm_campaign": "wave-1",
            }
        )

        self.assertEqual(result, {"ok": True, "lead_id": 42})
        mock_connect.assert_not_called()
        mock_pg_ingest.assert_called_once()
        pg_payload = mock_pg_ingest.call_args.args[0]
        self.assertEqual(pg_payload["channel"], "website")
        self.assertEqual(pg_payload["lead"]["raw"]["full_name"], "PG Form Lead")


if __name__ == "__main__":
    unittest.main()
