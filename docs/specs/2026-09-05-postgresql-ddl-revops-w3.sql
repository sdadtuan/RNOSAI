-- RevOps Wave 3 — commission, SLA, territory & routing (REVOPS-20260905-w3)

CREATE TABLE IF NOT EXISTS crm_revops_commission_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL DEFAULT 'PTT',
  name TEXT NOT NULL,
  version INT NOT NULL,
  effective_from DATE NOT NULL,
  effective_to DATE,
  revenue_basis TEXT NOT NULL,
  role_code TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT crm_revops_commission_plans_basis_chk CHECK (
    revenue_basis IN ('collected', 'booked', 'weighted')
  ),
  CONSTRAINT crm_revops_commission_plans_role_chk CHECK (
    role_code IN ('ae', 'am', 'team_lead', 'sales_director')
  ),
  CONSTRAINT crm_revops_commission_plans_status_chk CHECK (
    status IN ('draft', 'published', 'archived')
  ),
  UNIQUE (tenant_id, name, version)
);

CREATE TABLE IF NOT EXISTS crm_revops_commission_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES crm_revops_commission_plans(id) ON DELETE CASCADE,
  min_attainment_pct NUMERIC NOT NULL,
  max_attainment_pct NUMERIC,
  rate_pct NUMERIC NOT NULL,
  CONSTRAINT crm_revops_commission_tiers_range_chk CHECK (
    max_attainment_pct IS NULL OR max_attainment_pct >= min_attainment_pct
  )
);

CREATE INDEX IF NOT EXISTS crm_revops_commission_tiers_plan_idx
  ON crm_revops_commission_tiers (plan_id);

CREATE TABLE IF NOT EXISTS crm_revops_payout_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL DEFAULT 'PTT',
  period TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  locked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT crm_revops_payout_batches_status_chk CHECK (
    status IN ('draft', 'locked', 'reconciled')
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS crm_revops_payout_batches_period_uq
  ON crm_revops_payout_batches (tenant_id, period)
  WHERE status IN ('draft', 'locked');

CREATE TABLE IF NOT EXISTS crm_revops_commission_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL DEFAULT 'PTT',
  deal_ref TEXT NOT NULL,
  staff_id INT NOT NULL,
  eligible_vnd BIGINT NOT NULL,
  rate_pct NUMERIC NOT NULL,
  split_pct NUMERIC NOT NULL DEFAULT 100,
  commission_vnd BIGINT NOT NULL,
  status TEXT NOT NULL,
  payout_batch_id UUID REFERENCES crm_revops_payout_batches(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT crm_revops_commission_tx_status_chk CHECK (
    status IN ('pending_collection', 'pending_finance', 'approved', 'paid', 'clawback')
  )
);

CREATE INDEX IF NOT EXISTS crm_revops_commission_tx_staff_idx
  ON crm_revops_commission_transactions (tenant_id, staff_id, status);
CREATE INDEX IF NOT EXISTS crm_revops_commission_tx_deal_idx
  ON crm_revops_commission_transactions (tenant_id, deal_ref);

CREATE TABLE IF NOT EXISTS crm_revops_sla_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL DEFAULT 'PTT',
  name TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  duration_minutes INT NOT NULL,
  warning_minutes INT NOT NULL,
  escalate_json JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT crm_revops_sla_policies_entity_chk CHECK (
    entity_type IN ('lead_first_response', 'handover_accept', 'renewal_prep')
  )
);

CREATE TABLE IF NOT EXISTS crm_revops_sla_incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL DEFAULT 'PTT',
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  policy_id UUID REFERENCES crm_revops_sla_policies(id),
  owner_id INT,
  due_at TIMESTAMPTZ NOT NULL,
  breached_at TIMESTAMPTZ,
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT crm_revops_sla_incidents_status_chk CHECK (
    status IN ('open', 'warning', 'breached', 'resolved')
  )
);

CREATE INDEX IF NOT EXISTS crm_revops_sla_incidents_due_idx
  ON crm_revops_sla_incidents (tenant_id, status, due_at);

CREATE TABLE IF NOT EXISTS crm_revops_territories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL DEFAULT 'PTT',
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  parent_id UUID REFERENCES crm_revops_territories(id),
  team_label TEXT,
  capacity INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT crm_revops_territories_type_chk CHECK (
    type IN ('region', 'team', 'pod')
  )
);

CREATE INDEX IF NOT EXISTS crm_revops_territories_parent_idx
  ON crm_revops_territories (parent_id);

CREATE TABLE IF NOT EXISTS crm_revops_routing_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL DEFAULT 'PTT',
  name TEXT NOT NULL,
  priority INT NOT NULL,
  condition_json JSONB NOT NULL,
  method TEXT NOT NULL,
  fallback TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT crm_revops_routing_rules_method_chk CHECK (
    method IN ('round_robin', 'named_account', 'territory', 'capacity')
  ),
  CONSTRAINT crm_revops_routing_rules_status_chk CHECK (
    status IN ('draft', 'published')
  )
);

CREATE INDEX IF NOT EXISTS crm_revops_routing_rules_priority_idx
  ON crm_revops_routing_rules (tenant_id, status, priority);

-- DOWN (manual rollback)
-- DROP TABLE IF EXISTS crm_revops_routing_rules;
-- DROP TABLE IF EXISTS crm_revops_territories;
-- DROP TABLE IF EXISTS crm_revops_sla_incidents;
-- DROP TABLE IF EXISTS crm_revops_sla_policies;
-- DROP TABLE IF EXISTS crm_revops_commission_transactions;
-- DROP TABLE IF EXISTS crm_revops_payout_batches;
-- DROP TABLE IF EXISTS crm_revops_commission_tiers;
-- DROP TABLE IF EXISTS crm_revops_commission_plans;
