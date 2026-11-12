-- Portal Inbox (Pancake-style) additive DDL. Idempotent, scoped by client_id.
-- Apply via ensurePortalCrmLocalSchema() or locally:
--   psql "$DATABASE_URL" -f services/ptt-crm-api/src/portal/sql/02_portal_inbox_pancake.sql
-- Review only — do not run against production database hosts.

ALTER TABLE portal_care_cases ADD COLUMN IF NOT EXISTS notes TEXT NOT NULL DEFAULT '';
ALTER TABLE portal_care_cases ADD COLUMN IF NOT EXISTS last_read_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS portal_quick_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients (id) ON DELETE CASCADE,
  shortcut VARCHAR(40) NOT NULL,
  title VARCHAR(80) NOT NULL DEFAULT '',
  body TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS portal_quick_replies_client_shortcut_uq
  ON portal_quick_replies (client_id, shortcut);
CREATE INDEX IF NOT EXISTS portal_quick_replies_client_idx
  ON portal_quick_replies (client_id, sort_order, created_at);
