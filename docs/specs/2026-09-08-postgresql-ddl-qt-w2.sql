CREATE TABLE IF NOT EXISTS crm_quote_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id UUID NOT NULL REFERENCES crm_quote_versions(id) ON DELETE CASCADE,
  option_key TEXT NOT NULL,
  name TEXT NOT NULL,
  recommended BOOLEAN NOT NULL DEFAULT FALSE,
  client_visible BOOLEAN NOT NULL DEFAULT TRUE,
  payable_vnd BIGINT NOT NULL DEFAULT 0,
  UNIQUE (version_id, option_key)
);

CREATE TABLE IF NOT EXISTS crm_quote_kpis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id UUID NOT NULL REFERENCES crm_quote_versions(id) ON DELETE CASCADE,
  option_key TEXT,
  name TEXT NOT NULL,
  class TEXT NOT NULL,
  value_text TEXT NOT NULL,
  source TEXT,
  assumption TEXT,
  CONSTRAINT crm_quote_kpis_class_chk CHECK (
    class IN ('committed','optimization_target','projected_result','assumption_input')
  )
);

CREATE TABLE IF NOT EXISTS crm_quote_deliverables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  line_id INTEGER NOT NULL REFERENCES crm_quote_line_item(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  qty INTEGER,
  format TEXT,
  acceptance TEXT
);

CREATE TABLE IF NOT EXISTS crm_quote_clauses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id UUID NOT NULL REFERENCES crm_quote_versions(id) ON DELETE CASCADE,
  template_key TEXT NOT NULL,
  body TEXT NOT NULL,
  diverged BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS crm_quote_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id UUID NOT NULL REFERENCES crm_quote_versions(id),
  policy_snapshot JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS crm_quote_approval_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  approval_id UUID NOT NULL REFERENCES crm_quote_approvals(id) ON DELETE CASCADE,
  seq INTEGER NOT NULL,
  section TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'locked',
  assignee_staff_id INTEGER,
  sla_hours INTEGER,
  acted_at TIMESTAMPTZ,
  comment TEXT,
  delegate_from INTEGER,
  CONSTRAINT crm_quote_step_state_chk CHECK (
    state IN ('done','waiting','locked','skipped')
  )
);

CREATE TABLE IF NOT EXISTS crm_quote_publications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id UUID NOT NULL REFERENCES crm_quote_versions(id),
  published_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  published_by INTEGER NOT NULL,
  revoked_at TIMESTAMPTZ
);

ALTER TABLE crm_quote_shares
  ADD COLUMN IF NOT EXISTS publication_id UUID REFERENCES crm_quote_publications(id);

CREATE TABLE IF NOT EXISTS crm_quote_view_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  share_id UUID NOT NULL REFERENCES crm_quote_shares(id),
  section_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS crm_quote_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id UUID NOT NULL REFERENCES crm_quote_versions(id),
  author_kind TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS crm_quote_acceptances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id UUID NOT NULL REFERENCES crm_quote_versions(id),
  option_key TEXT NOT NULL,
  signer_name TEXT NOT NULL,
  signer_title TEXT NOT NULL,
  signer_email TEXT NOT NULL,
  accepted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip TEXT,
  user_agent TEXT
);

CREATE TABLE IF NOT EXISTS crm_quote_rate_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL DEFAULT 'PTT',
  dv_code TEXT NOT NULL,
  package_tier TEXT NOT NULL,
  fee_vnd BIGINT NOT NULL,
  cost_labor_vnd BIGINT,
  effective_from DATE NOT NULL,
  effective_to DATE,
  state TEXT NOT NULL DEFAULT 'active'
);

CREATE TABLE IF NOT EXISTS crm_quote_cost_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rate_card_id UUID NOT NULL REFERENCES crm_quote_rate_cards(id),
  labor_vnd BIGINT,
  outsource_vnd BIGINT,
  tools_vnd BIGINT
);

CREATE TABLE IF NOT EXISTS crm_quote_catalog_revisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  catalog_service_id TEXT NOT NULL,
  profile_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
