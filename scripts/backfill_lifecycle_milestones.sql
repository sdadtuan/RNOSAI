-- One-shot backfill for crm_lifecycle_milestones (idempotent)
-- Run after docs/specs/2026-08-29-lifecycle-milestones-ddl.sql

INSERT INTO crm_lifecycle_milestones (lead_id, milestone_key, occurred_at, source, ref_id)
SELECT
  l.sqlite_lead_id,
  'b2_done',
  (l.care_stages_done_json->>'first_contact')::timestamptz,
  'backfill',
  ''
FROM crm_leads l
WHERE l.care_stages_done_json->>'first_contact' IS NOT NULL
  AND trim(l.care_stages_done_json->>'first_contact') <> ''
  AND (l.care_stages_done_json->>'first_contact')::timestamptz IS NOT NULL
ON CONFLICT (lead_id, milestone_key) DO NOTHING;

INSERT INTO crm_lifecycle_milestones (lead_id, milestone_key, occurred_at, source, ref_id)
SELECT DISTINCT ON (s.lead_id)
  s.lead_id,
  'intake_go',
  COALESCE(s.completed_at, s.updated_at),
  'backfill',
  s.id::text
FROM crm_lead_intake_sessions s
WHERE lower(trim(COALESCE(s.decision, ''))) = 'go'
  AND lower(trim(COALESCE(s.status, ''))) = 'completed'
  AND s.lead_id IS NOT NULL
ORDER BY s.lead_id, s.completed_at DESC NULLS LAST, s.id DESC
ON CONFLICT (lead_id, milestone_key) DO NOTHING;

INSERT INTO crm_lifecycle_milestones (lead_id, milestone_key, occurred_at, source, ref_id, payload_json)
SELECT
  c.lead_id,
  'contract_active',
  COALESCE(c.updated_at, c.created_at),
  'backfill',
  c.id::text,
  jsonb_build_object('lifecycle_id', c.lifecycle_id)
FROM crm_contracts c
WHERE lower(trim(COALESCE(c.status, ''))) = 'active'
  AND c.lead_id IS NOT NULL
ON CONFLICT (lead_id, milestone_key) DO NOTHING;

INSERT INTO crm_lifecycle_milestones (lead_id, milestone_key, occurred_at, source, ref_id)
SELECT
  l.sqlite_lead_id,
  'client_active',
  COALESCE(c.updated_at, c.created_at),
  'backfill',
  c.id::text
FROM clients c
JOIN crm_leads l ON l.agency_client_id = c.id
WHERE lower(trim(COALESCE(c.status, ''))) = 'active'
ON CONFLICT (lead_id, milestone_key) DO NOTHING;
