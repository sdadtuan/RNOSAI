"""Regression checks for Wave 2 Task 20 PostgreSQL script migration."""
from __future__ import annotations

import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = ROOT / "scripts"


class Task20PostgresScriptsTests(unittest.TestCase):
    def test_local_crm_api_requires_postgres(self) -> None:
        script = (SCRIPTS / "local_crm_api_up.sh").read_text(encoding="utf-8")
        self.assertIn('${DATABASE_URL:?DATABASE_URL required', script)
        self.assertNotIn("PTT_SQLITE_PATH", script)

    def test_playwright_scripts_do_not_configure_sqlite_or_default_database(self) -> None:
        scripts = sorted(SCRIPTS.glob("playwright_ops_*.sh"))
        self.assertGreaterEqual(len(scripts), 25)
        for path in scripts:
            script = path.read_text(encoding="utf-8")
            with self.subTest(script=path.name):
                self.assertNotIn("PTT_SQLITE_PATH", script)
                self.assertNotIn("sqlite3", script)
                self.assertNotIn("DATABASE_URL:-postgresql://", script)

    def test_pg_e2e_helper_requires_database_url(self) -> None:
        helper = (SCRIPTS / "lib" / "pg_e2e_env.sh").read_text(encoding="utf-8")
        self.assertIn('${DATABASE_URL:?DATABASE_URL required', helper)
        self.assertIn('PTT_LEADS_READ_SOURCE="${PTT_LEADS_READ_SOURCE:-pg}"', helper)
        self.assertIn('PTT_LEADS_WRITE_SOURCE="${PTT_LEADS_WRITE_SOURCE:-pg}"', helper)

    def test_ai_copilot_bootstrap_seeds_postgres_only(self) -> None:
        script = (SCRIPTS / "rnos39_e2e_bootstrap.sh").read_text(encoding="utf-8")
        self.assertIn("INSERT INTO crm_leads", script)
        self.assertNotIn("PTT_SQLITE_PATH", script)
        self.assertNotIn("sqlite3", script)

    def test_post_v3_deploy_skips_retired_sqlite_hub_sync(self) -> None:
        script = (SCRIPTS / "deploy_post_v3.sh").read_text(encoding="utf-8")
        hub_section = script[script.index('if [[ "$SKIP_HUB"'):script.index('if [[ "$WITH_MODULES"')]
        self.assertNotIn("PTT_SQLITE_PATH", hub_section)
        self.assertNotIn("sync_hub_campaign_map.sh", hub_section)
        self.assertIn("retired with SQLite", hub_section)

    def test_backup_is_postgres_only_and_requires_database_url(self) -> None:
        script = (SCRIPTS / "backup_ptt_data.sh").read_text(encoding="utf-8")
        self.assertIn('${DATABASE_URL:?DATABASE_URL required', script)
        self.assertNotIn("PTT_SQLITE_PATH", script)
        self.assertNotIn("SQLITE_", script)
        self.assertNotIn("ptt-*.db", script)


if __name__ == "__main__":
    unittest.main()
