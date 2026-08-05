"""Tests crm_presales_funnel_metrics — parity with Nest util."""
from __future__ import annotations

import sqlite3
import unittest

from crm_presales_funnel_metrics import compute_presales_funnel_metrics, get_presales_funnel_metrics


class TestPresalesFunnelMetrics(unittest.TestCase):
    def test_compute_metrics(self) -> None:
        out = compute_presales_funnel_metrics(
            {
                "go_to_consult": [
                    {
                        "intake_go_completed_at": "2026-08-01 10:00:00",
                        "consult_entered_at": "2026-08-02 10:00:00",
                    },
                    {
                        "intake_go_completed_at": "2026-08-01 10:00:00",
                        "consult_entered_at": "2026-08-03 10:00:00",
                    },
                ],
                "consult_to_proposal": [
                    {
                        "consult_entered_at": "2026-08-01 10:00:00",
                        "proposal_entered_at": "2026-08-02 10:00:00",
                    },
                    {
                        "consult_entered_at": "2026-08-01 10:00:00",
                        "proposal_entered_at": "2026-08-10 10:00:00",
                    },
                ],
                "consult_tasks": [
                    {
                        "form_fields": [{"key": "a"}, {"key": "b"}],
                        "form_data": {"a": "x", "b": ""},
                        "is_done": False,
                    },
                    {
                        "form_fields": [{"key": "a"}],
                        "form_data": {"a": "ok"},
                        "is_done": True,
                    },
                ],
            }
        )
        self.assertEqual(out["go_to_consult_median_hours"], 36.0)
        self.assertEqual(out["go_to_consult_sample"], 2)
        self.assertEqual(out["consult_to_proposal_48h_num"], 1)
        self.assertEqual(out["consult_to_proposal_48h_denom"], 2)
        self.assertEqual(out["consult_to_proposal_48h_pct"], 50.0)
        self.assertEqual(out["consult_to_proposal_7d_num"], 1)
        self.assertEqual(out["consult_task_done_rate"], 50.0)
        self.assertEqual(out["consult_form_completion_pct"], 75.0)

    def test_get_presales_funnel_metrics_sqlite(self) -> None:
        conn = sqlite3.connect(":memory:")
        conn.executescript(
            """
            CREATE TABLE crm_leads (
              id INTEGER PRIMARY KEY,
              owner_id INTEGER
            );
            CREATE TABLE crm_lead_presales (
              id INTEGER PRIMARY KEY,
              lead_id INTEGER,
              assigned_am INTEGER,
              consult_entered_at TEXT,
              proposal_entered_at TEXT
            );
            CREATE TABLE crm_lead_intake_sessions (
              id INTEGER PRIMARY KEY,
              lead_id INTEGER,
              status TEXT,
              decision TEXT,
              completed_at TEXT
            );
            CREATE TABLE crm_lead_presales_tasks (
              id INTEGER PRIMARY KEY,
              presales_id INTEGER,
              stage TEXT,
              is_custom INTEGER,
              form_fields TEXT,
              form_data TEXT,
              is_done INTEGER
            );
            INSERT INTO crm_leads (id, owner_id) VALUES (1, 10);
            INSERT INTO crm_lead_presales (id, lead_id, assigned_am, consult_entered_at, proposal_entered_at)
              VALUES (1, 1, 10, '2026-08-02 10:00:00', '2026-08-03 10:00:00');
            INSERT INTO crm_lead_intake_sessions (lead_id, status, decision, completed_at)
              VALUES (1, 'completed', 'go', '2026-08-01 10:00:00');
            INSERT INTO crm_lead_presales_tasks (presales_id, stage, is_custom, form_fields, form_data, is_done)
              VALUES (1, 'consult', 0, '[{"key":"a"}]', '{"a":"x"}', 1);
            """
        )
        out = get_presales_funnel_metrics(conn, am_id=10)
        m = out["metrics"]
        self.assertEqual(m["go_to_consult_median_hours"], 24.0)
        self.assertEqual(m["consult_to_proposal_48h_num"], 1)
        self.assertEqual(m["consult_form_completion_pct"], 100.0)
        self.assertEqual(m["consult_task_done_rate"], 100.0)
        conn.close()


if __name__ == "__main__":
    unittest.main()
