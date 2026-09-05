CREATE TABLE IF NOT EXISTS crm_am_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL DEFAULT 'PTT',
  agency_client_id UUID NOT NULL,
  full_name TEXT NOT NULL,
  role_committee TEXT,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  sentiment TEXT,
  channel TEXT,
  renewal_attitude TEXT,
  email TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS crm_am_handovers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL DEFAULT 'PTT',
  agency_client_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  commercial_json JSONB NOT NULL DEFAULT '{}',
  scope_json JSONB NOT NULL DEFAULT '{}',
  stakeholders_json JSONB NOT NULL DEFAULT '{}',
  reject_reason TEXT,
  accepted_by_staff_id INTEGER,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT crm_am_handovers_status_chk CHECK (
    status IN ('draft','pending_am','accepted','rejected','needs_info')
  )
);

CREATE TABLE IF NOT EXISTS crm_am_onboarding_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL DEFAULT 'PTT',
  name TEXT NOT NULL,
  version INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  items_json JSONB NOT NULL,
  UNIQUE (tenant_id, name, version)
);

CREATE TABLE IF NOT EXISTS crm_am_onboarding_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL DEFAULT 'PTT',
  agency_client_id UUID NOT NULL,
  template_id UUID,
  status TEXT NOT NULL DEFAULT 'open',
  go_live_on DATE,
  items_json JSONB NOT NULL,
  override_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS crm_am_renewal_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL DEFAULT 'PTT',
  agency_client_id UUID NOT NULL,
  contract_id BIGINT NOT NULL,
  status TEXT NOT NULL DEFAULT 'not_started',
  forecast TEXT,
  forecast_pct INTEGER,
  next_action TEXT,
  lost_reason TEXT,
  lost_on DATE,
  lessons TEXT,
  new_contract_id BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT crm_am_renewal_status_chk CHECK (
    status IN ('not_started','evaluating','negotiating','decided','renewed','lost','paused')
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS crm_am_renewal_open_uq
  ON crm_am_renewal_cases (tenant_id, contract_id)
  WHERE status NOT IN ('renewed','lost');
