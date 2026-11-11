-- Review only — columns are included in sql/00_portal_crm_local.sql (ensurePortalCrmLocalSchema).
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
