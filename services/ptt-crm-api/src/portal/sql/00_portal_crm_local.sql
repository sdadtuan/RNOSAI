-- Portal CRM local DDL (idempotent).
-- Apply via ensurePortalCrmLocalSchema() in ptt-crm-api, or locally:
--   psql "$DATABASE_URL" -f services/ptt-crm-api/src/portal/sql/00_portal_crm_local.sql
-- Review only — do not run against production database hosts.

-- ---------------------------------------------------------------------------
-- portal_client_pages, leads, messages (agency + portal inbox)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS portal_client_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients (id) ON DELETE CASCADE,
  page_id VARCHAR(64) NOT NULL,
  page_name VARCHAR(255) NOT NULL DEFAULT '',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS portal_client_pages_client_idx ON portal_client_pages (client_id);
ALTER TABLE portal_client_pages ADD COLUMN IF NOT EXISTS channel VARCHAR(16) NOT NULL DEFAULT 'facebook';
DROP INDEX IF EXISTS portal_client_pages_page_id_uq;
CREATE UNIQUE INDEX IF NOT EXISTS portal_client_pages_channel_page_uq ON portal_client_pages (channel, page_id);

CREATE TABLE IF NOT EXISTS portal_page_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients (id) ON DELETE CASCADE,
  page_id VARCHAR(64) NOT NULL,
  external_lead_id VARCHAR(64) NOT NULL DEFAULT '',
  full_name TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  campaign_name TEXT NOT NULL DEFAULT '',
  campaign_id TEXT NOT NULL DEFAULT '',
  ad_id TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE portal_page_leads ADD COLUMN IF NOT EXISTS campaign_id TEXT NOT NULL DEFAULT '';
ALTER TABLE portal_page_leads ADD COLUMN IF NOT EXISTS ad_id TEXT NOT NULL DEFAULT '';
CREATE UNIQUE INDEX IF NOT EXISTS portal_page_leads_ext_uq
  ON portal_page_leads (page_id, external_lead_id)
  WHERE external_lead_id <> '';
CREATE INDEX IF NOT EXISTS portal_page_leads_client_page_idx ON portal_page_leads (client_id, page_id);

CREATE TABLE IF NOT EXISTS portal_page_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients (id) ON DELETE CASCADE,
  page_id VARCHAR(64) NOT NULL,
  external_message_id VARCHAR(128) NOT NULL DEFAULT '',
  sender_name TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS portal_page_messages_client_page_idx ON portal_page_messages (client_id, page_id);

-- message extensions (Prompt 4 / inbox sync)
ALTER TABLE portal_page_messages ADD COLUMN IF NOT EXISTS direction VARCHAR(8) NOT NULL DEFAULT 'in';
ALTER TABLE portal_page_messages ADD COLUMN IF NOT EXISTS sender_psid VARCHAR(64) NOT NULL DEFAULT '';
ALTER TABLE portal_page_messages ALTER COLUMN external_message_id TYPE TEXT;
CREATE INDEX IF NOT EXISTS portal_page_messages_client_received_idx
  ON portal_page_messages (client_id, received_at);
CREATE UNIQUE INDEX IF NOT EXISTS portal_page_messages_ext_uq
  ON portal_page_messages (page_id, external_message_id)
  WHERE external_message_id <> '';

-- ---------------------------------------------------------------------------
-- portal_client_users role check (staff portal)
-- ---------------------------------------------------------------------------
DO $$
DECLARE cname text;
BEGIN
  IF to_regclass('public.portal_client_users') IS NULL THEN
    RETURN;
  END IF;
  FOR cname IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'portal_client_users'::regclass AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%role%'
  LOOP
    EXECUTE format('ALTER TABLE portal_client_users DROP CONSTRAINT %I', cname);
  END LOOP;
  ALTER TABLE portal_client_users
    ADD CONSTRAINT portal_client_users_role_check
    CHECK (role IN ('viewer', 'approver', 'staff'));
END $$;

-- ---------------------------------------------------------------------------
-- portal CRM care / customers / products / labels / cursors
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS portal_care_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients (id) ON DELETE CASCADE,
  page_id VARCHAR(64) NOT NULL,
  channel VARCHAR(16) NOT NULL DEFAULT 'facebook',
  kind VARCHAR(16) NOT NULL,
  thread_key TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  assignee_user_id UUID,
  status VARCHAR(24) NOT NULL DEFAULT 'waiting_receive',
  labels TEXT[] NOT NULL DEFAULT '{}',
  customer_id UUID,
  assigned_at TIMESTAMPTZ,
  receive_due_at TIMESTAMPTZ,
  received_at TIMESTAMPTZ,
  care_started_at TIMESTAMPTZ,
  care_due_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE portal_care_cases ADD COLUMN IF NOT EXISTS order_draft JSONB NOT NULL DEFAULT '{}'::jsonb;
CREATE UNIQUE INDEX IF NOT EXISTS portal_care_cases_thread_uq ON portal_care_cases (client_id, thread_key);
CREATE INDEX IF NOT EXISTS portal_care_cases_client_idx ON portal_care_cases (client_id, status);

CREATE TABLE IF NOT EXISTS portal_customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients (id) ON DELETE CASCADE,
  page_id VARCHAR(64) NOT NULL,
  display_name TEXT NOT NULL DEFAULT '',
  thread_key TEXT NOT NULL,
  case_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (client_id, thread_key)
);
ALTER TABLE portal_customers ADD COLUMN IF NOT EXISTS phone TEXT NOT NULL DEFAULT '';
ALTER TABLE portal_customers ADD COLUMN IF NOT EXISTS email TEXT NOT NULL DEFAULT '';
ALTER TABLE portal_customers ADD COLUMN IF NOT EXISTS psid TEXT NOT NULL DEFAULT '';
ALTER TABLE portal_customers ADD COLUMN IF NOT EXISTS last_interaction_at TIMESTAMPTZ;
ALTER TABLE portal_customers ADD COLUMN IF NOT EXISTS source_lead_id UUID NULL;
ALTER TABLE portal_customers ADD COLUMN IF NOT EXISTS source_conversation_case_id UUID NULL;
CREATE INDEX IF NOT EXISTS portal_customers_client_phone_idx
  ON portal_customers (client_id, lower(phone)) WHERE phone <> '';
CREATE INDEX IF NOT EXISTS portal_customers_client_email_idx
  ON portal_customers (client_id, lower(email)) WHERE email <> '';
CREATE INDEX IF NOT EXISTS portal_customers_client_psid_idx
  ON portal_customers (client_id, psid) WHERE psid <> '';

CREATE TABLE IF NOT EXISTS portal_page_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients (id) ON DELETE CASCADE,
  page_id VARCHAR(64) NOT NULL,
  body TEXT NOT NULL,
  published_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS portal_page_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients (id) ON DELETE CASCADE,
  page_id VARCHAR(64) NOT NULL,
  name TEXT NOT NULL,
  image_url TEXT NOT NULL DEFAULT '',
  detail TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE portal_page_products ADD COLUMN IF NOT EXISTS spec JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE portal_page_products ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT TRUE;

CREATE TABLE IF NOT EXISTS portal_page_inbox_cursors (
  client_id UUID NOT NULL REFERENCES clients (id) ON DELETE CASCADE,
  page_id VARCHAR(64) NOT NULL,
  conv_after TEXT NOT NULL DEFAULT '',
  form_after TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (client_id, page_id)
);
ALTER TABLE portal_page_inbox_cursors ADD COLUMN IF NOT EXISTS last_polled_at TIMESTAMPTZ;
ALTER TABLE portal_page_inbox_cursors ADD COLUMN IF NOT EXISTS last_error TEXT NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS portal_page_labels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients (id) ON DELETE CASCADE,
  name VARCHAR(40) NOT NULL,
  color VARCHAR(16) NOT NULL DEFAULT '#1877f2',
  UNIQUE (client_id, name)
);

-- ---------------------------------------------------------------------------
-- Meta Business token (agency ops)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ptt_meta_business_token (
  id TEXT PRIMARY KEY,
  access_token_encrypted BYTEA NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE portal_page_leads ADD COLUMN IF NOT EXISTS field_data JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE portal_page_leads ADD COLUMN IF NOT EXISTS adset_id TEXT NOT NULL DEFAULT '';
ALTER TABLE portal_page_leads ADD COLUMN IF NOT EXISTS form_id TEXT NOT NULL DEFAULT '';
