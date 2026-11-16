-- Portal lead funnel: form names + conversion timestamp.
-- Additive and idempotent. Applied via ensurePortalCrmLocalSchema().
-- Review only — do not run against production database hosts.

ALTER TABLE portal_page_leads
  ADD COLUMN IF NOT EXISTS form_name TEXT NOT NULL DEFAULT '';

ALTER TABLE portal_care_cases
  ADD COLUMN IF NOT EXISTS converted_at TIMESTAMPTZ;

COMMENT ON COLUMN portal_page_leads.form_name IS 'Human-readable Meta/Zalo lead form name; form_id is the external id.';
COMMENT ON COLUMN portal_care_cases.converted_at IS 'When the case was first converted to a customer (or purchased).';

-- Backfill: any case already linked to a customer is treated as converted.
UPDATE portal_care_cases c
SET converted_at = COALESCE(
  c.converted_at,
  (SELECT cu.created_at FROM portal_customers cu WHERE cu.id = c.customer_id),
  c.updated_at,
  c.created_at,
  NOW()
)
WHERE c.customer_id IS NOT NULL
  AND c.converted_at IS NULL;

CREATE INDEX IF NOT EXISTS portal_care_cases_converted_idx
  ON portal_care_cases (client_id, converted_at)
  WHERE converted_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS portal_page_leads_form_idx
  ON portal_page_leads (client_id, form_id)
  WHERE form_id <> '';
