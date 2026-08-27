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

    @patch.dict(os.environ, {"PTT_LEADS_WRITE_SOURCE": "pg"}, clear=False)
    @patch("ptt_crm.lead_ingest_pg.process_ingest_lead_payload_pg")
    def test_form_lead_ingest_module_pg_does_not_use_sqlite_conn(
        self,
        mock_pg_ingest: unittest.mock.MagicMock,
    ) -> None:
        from ptt_crm.form_lead_ingest import ingest_lead_from_form

        mock_pg_ingest.return_value = {
            "ok": True,
            "created_ids": [77],
            "created_count": 1,
        }

        mock_conn = unittest.mock.MagicMock()
        mock_conn.execute.side_effect = AssertionError("SQLite conn must not be used")

        lead_id = ingest_lead_from_form(
            mock_conn,
            full_name="Direct PG Form Lead",
            phone="0907654321",
            email="direct@example.com",
            need="Consult",
            source="website",
            region="HN",
            product_interest="ERP",
            utm_campaign="wave-1-direct",
            ts="2026-08-27T09:00:00+00:00",
            _from_worker=True,
        )

        self.assertEqual(lead_id, 77)
        mock_conn.execute.assert_not_called()
        mock_pg_ingest.assert_called_once()
        pg_payload = mock_pg_ingest.call_args.args[0]
        self.assertEqual(pg_payload["lead"]["raw"]["full_name"], "Direct PG Form Lead")


if __name__ == "__main__":
    unittest.main()
