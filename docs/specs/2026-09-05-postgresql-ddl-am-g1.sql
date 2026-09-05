-- AM-20260905-g1

CREATE TABLE IF NOT EXISTS crm_am_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL DEFAULT 'PTT',
  agency_client_id UUID NOT NULL,
  contract_id BIGINT,
  onboarding_case_id UUID,
  interaction_id UUID,
  title TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'link',
  href TEXT NOT NULL,
  created_by_staff_id INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT crm_am_documents_kind_chk CHECK (kind IN ('link'))
);

CREATE INDEX IF NOT EXISTS crm_am_documents_account_idx
  ON crm_am_documents (tenant_id, agency_client_id);

CREATE TABLE IF NOT EXISTS crm_am_delegations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL DEFAULT 'PTT',
  from_staff_id INTEGER NOT NULL,
  to_staff_id INTEGER NOT NULL,
  starts_on DATE NOT NULL,
  ends_on DATE NOT NULL,
  reason TEXT,
  created_by_staff_id INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT crm_am_delegations_range_chk CHECK (ends_on >= starts_on),
  CONSTRAINT crm_am_delegations_self_chk CHECK (from_staff_id <> to_staff_id)
);

CREATE INDEX IF NOT EXISTS crm_am_delegations_to_idx
  ON crm_am_delegations (tenant_id, to_staff_id, starts_on, ends_on);
CREATE INDEX IF NOT EXISTS crm_am_delegations_from_idx
  ON crm_am_delegations (tenant_id, from_staff_id, starts_on, ends_on);
