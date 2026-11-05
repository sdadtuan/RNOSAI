"""Tests for PostgreSQL-only form ingest routing."""
from __future__ import annotations

import json
import os
import unittest
from typing import Any
from unittest.mock import patch


class TestFormIngestPg(unittest.TestCase):
    def test_pg_project_resolver_uses_website_route(self) -> None:
        from ptt_crm.lead_ingest_pg import resolve_project_for_lead_ingest_pg

        class FakeCursor:
            def __enter__(self):
                return self

            def __exit__(self, *_args: Any) -> bool:
                return False

            def execute(self, sql: str, params: tuple[Any, ...]) -> None:
                self.sql = sql
                self.params = params

            def fetchone(self) -> tuple[int] | None:
                return (654,)

        class FakeConnection:
            cursor_instance = FakeCursor()

            def __enter__(self):
                return self

            def __exit__(self, *_args: Any) -> bool:
                return False

            def cursor(self) -> FakeCursor:
                return self.cursor_instance

        fake_connection = FakeConnection()
        with patch("ptt_crm.lead_ingest_pg.pg_connection", return_value=fake_connection):
            project_id = resolve_project_for_lead_ingest_pg(ingest_site="vsp.example")

        self.assertEqual(project_id, 654)
        self.assertIn("crm_re_project_website_routes", fake_connection.cursor_instance.sql)
        self.assertEqual(fake_connection.cursor_instance.params, ("vsp.example",))

    @patch("ptt_crm.lead_ingest_pg.shadow_sync_created")
    @patch("ptt_crm.lead_ingest_pg.ingest_webhook_leads_pg")
    @patch("ptt_crm.lead_ingest_pg.resolve_project_for_lead_ingest_pg", return_value=321)
    @patch("ptt_crm.lead_ingest_pg.pg_available", return_value=True)
    def test_pg_form_ingest_resolves_and_persists_re_project_attribution(
        self,
        _pg_available: unittest.mock.MagicMock,
        mock_resolve: unittest.mock.MagicMock,
        mock_ingest: unittest.mock.MagicMock,
        _shadow: unittest.mock.MagicMock,
    ) -> None:
        from ptt_crm.lead_ingest_pg import legacy_item_to_pg_record, process_ingest_lead_payload_pg

        captured: dict[str, Any] = {}

        def capture(items: list[dict[str, Any]], **kwargs: Any) -> dict[str, Any]:
            captured["record"] = legacy_item_to_pg_record(
                items[0],
                lead_id=880_001_234,
                channel=kwargs["channel"],
                client_id=kwargs["client_id"],
                default_source=kwargs["default_source"],
                ts=kwargs["ts"],
            )
            return {"created_ids": [], "created_count": 0, "skipped": [], "results": []}

        mock_ingest.side_effect = capture
        outcome = process_ingest_lead_payload_pg(
            {
                "channel": "website",
                "lead": {
                    "channel": "website",
                    "raw": {
                        "full_name": "Attributed Lead",
                        "phone": "0901234567",
                        "utm_campaign": "campaign-route",
                        "re_project_id": 999,
                        "re_project_code": "VSP",
                        "ingest_site": "vsp.example",
                    },
                },
            }
        )

        self.assertTrue(outcome["ok"])
        mock_resolve.assert_called_once_with(
            re_project_id=999,
            re_project_code="VSP",
            utm_campaign="campaign-route",
            ingest_site="vsp.example",
        )
        persisted_meta = json.loads(captured["record"]["meta_json"])
        self.assertEqual(persisted_meta["re_project_id"], 321)
        self.assertEqual(persisted_meta["re_project_code"], "VSP")
        self.assertEqual(persisted_meta["ingest_site"], "vsp.example")

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

    @patch.dict(os.environ, {"PTT_LEADS_WRITE_SOURCE": "sqlite"}, clear=False)
    @patch("ptt_crm.lead_ingest_pg.process_ingest_lead_payload_pg")
    @patch("sqlite3.connect", side_effect=AssertionError("SQLite forbidden"))
    def test_form_ingest_handler_has_no_sqlite_fallback(
        self,
        mock_connect: unittest.mock.MagicMock,
        mock_pg_ingest: unittest.mock.MagicMock,
    ) -> None:
        from ptt_jobs.handlers.form_ingest import process_form_ingest_payload

        mock_pg_ingest.return_value = {
            "ok": True,
            "created_ids": [43],
            "created_count": 1,
        }

        result = process_form_ingest_payload(
            {"full_name": "Always PG Form Lead", "phone": "0901234568"}
        )

        self.assertEqual(result, {"ok": True, "lead_id": 43})
        mock_connect.assert_not_called()
        mock_pg_ingest.assert_called_once()

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

    @patch.dict(os.environ, {"PTT_LEADS_WRITE_SOURCE": "sqlite"}, clear=False)
    @patch("ptt_crm.lead_ingest_pg.process_ingest_lead_payload_pg")
    def test_form_lead_ingest_has_no_sqlite_fallback(
        self,
        mock_pg_ingest: unittest.mock.MagicMock,
    ) -> None:
        from ptt_crm.form_lead_ingest import ingest_lead_from_form

        mock_pg_ingest.return_value = {
            "ok": True,
            "created_ids": [78],
            "created_count": 1,
        }
        mock_conn = unittest.mock.MagicMock()
        mock_conn.execute.side_effect = AssertionError("SQLite conn must not be used")

        lead_id = ingest_lead_from_form(
            mock_conn,
            full_name="PG-only Form Lead",
            phone="0907654322",
            email="pg-only@example.com",
            need="Consult",
            source="website",
            ts="2026-08-27T09:00:00+00:00",
            _from_worker=True,
        )

        self.assertEqual(lead_id, 78)
        mock_conn.execute.assert_not_called()
        mock_pg_ingest.assert_called_once()

    @patch.dict(os.environ, {"PTT_LEADS_WRITE_SOURCE": "sqlite"}, clear=False)
    @patch("ptt_crm.lead_ingest_pg.process_ingest_lead_payload_pg")
    @patch("sqlite3.connect", side_effect=AssertionError("SQLite forbidden"))
    def test_ingest_lead_handler_has_no_sqlite_fallback(
        self,
        mock_connect: unittest.mock.MagicMock,
        mock_pg_ingest: unittest.mock.MagicMock,
    ) -> None:
        from ptt_jobs.handlers.ingest_lead import process_ingest_lead_payload

        mock_pg_ingest.return_value = {
            "ok": True,
            "created_ids": [79],
            "created_count": 1,
        }

        result = process_ingest_lead_payload(
            {
                "channel": "website",
                "lead": {"channel": "website", "raw": {"full_name": "Worker PG-only Lead"}},
            }
        )

        self.assertTrue(result["ok"])
        mock_connect.assert_not_called()
        mock_pg_ingest.assert_called_once()

    @patch.dict(os.environ, {"PTT_LEADS_WRITE_SOURCE": "pg"}, clear=False)
    @patch("ptt_jobs.form_ingest_failure.notify_form_ingest_dead")
    @patch("ptt_jobs.form_ingest_failure.jobs_sync_fallback", return_value=False)
    @patch("ptt_jobs.form_ingest_failure.jobs_enabled", return_value=False)
    @patch("sqlite3.connect", side_effect=AssertionError("SQLite forbidden"))
    def test_pg_form_ingest_failure_fails_closed_without_sqlite_spillover(
        self,
        mock_connect: unittest.mock.MagicMock,
        _jobs: unittest.mock.MagicMock,
        _sync: unittest.mock.MagicMock,
        mock_notify: unittest.mock.MagicMock,
    ) -> None:
        from ptt_jobs.form_ingest_failure import enqueue_form_ingest_failure

        outcome = enqueue_form_ingest_failure(
            full_name="Failed PG Lead",
            phone="0909999888",
            email="",
            error="PG unavailable",
        )

        self.assertEqual(outcome["mode"], "failed_closed")
        self.assertFalse(outcome["ok"])
        mock_connect.assert_not_called()
        mock_notify.assert_called_once()


if __name__ == "__main__":
    unittest.main()
