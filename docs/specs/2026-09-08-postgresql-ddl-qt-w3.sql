CREATE TABLE IF NOT EXISTS crm_quote_import_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL DEFAULT 'PTT',
  filename TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'queued',
  result_json JSONB NOT NULL DEFAULT '{}',
  created_by INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE crm_quote_approval_steps
  ADD COLUMN IF NOT EXISTS escalated_at TIMESTAMPTZ;

ALTER TABLE crm_proposals
  ADD COLUMN IF NOT EXISTS lost_reason TEXT;

CREATE TABLE IF NOT EXISTS crm_quote_esign_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  acceptance_id UUID REFERENCES crm_quote_acceptances(id),
  provider TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'stub',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
