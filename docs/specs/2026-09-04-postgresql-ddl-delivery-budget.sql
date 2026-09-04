-- Wave C: delivery budget + resources
-- Apply after 2026-09-04-postgresql-ddl-delivery-projects.sql

ALTER TABLE crm_delivery_projects
  ADD COLUMN IF NOT EXISTS contract_budget NUMERIC,
  ADD COLUMN IF NOT EXISTS internal_cost_budget NUMERIC,
  ADD COLUMN IF NOT EXISTS client_media_budget NUMERIC,
  ADD COLUMN IF NOT EXISTS contingency_amount NUMERIC,
  ADD COLUMN IF NOT EXISTS forecast_cost NUMERIC,
  ADD COLUMN IF NOT EXISTS gross_margin_pct NUMERIC,
  ADD COLUMN IF NOT EXISTS finance_policy_json JSONB NOT NULL DEFAULT '{
    "min_gross_margin_pct": 30,
    "forecast_over_budget_warn": true,
    "require_finance_on_threshold": true,
    "block_over_capacity": false
  }'::jsonb;

CREATE TABLE IF NOT EXISTS crm_delivery_budget_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES crm_delivery_projects(id),
  name TEXT NOT NULL,
  service_code TEXT,
  kind TEXT NOT NULL CHECK (kind IN ('labor','production','software','media','other')),
  media_borne TEXT CHECK (media_borne IN ('agency_borne','client_borne')),
  cost_center TEXT,
  owner_staff_id INT,
  approved_budget NUMERIC NOT NULL DEFAULT 0,
  forecast NUMERIC NOT NULL DEFAULT 0,
  actual NUMERIC NOT NULL DEFAULT 0,
  allocation_method TEXT NOT NULL DEFAULT 'even' CHECK (allocation_method IN ('even','milestone','manual')),
  description TEXT,
  row_version INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT crm_delivery_budget_items_media_borne_chk
    CHECK (kind <> 'media' OR media_borne IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS crm_delivery_budget_items_project_idx
  ON crm_delivery_budget_items (project_id) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS crm_delivery_budget_allocs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES crm_delivery_budget_items(id),
  period TEXT,
  milestone_id UUID,
  amount NUMERIC NOT NULL,
  UNIQUE (item_id, period, milestone_id)
);

CREATE TABLE IF NOT EXISTS crm_delivery_resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES crm_delivery_projects(id),
  staff_id INT NOT NULL,
  role_name TEXT,
  team_name TEXT,
  allocation_pct NUMERIC NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  estimated_cost NUMERIC,
  overload_reason TEXT,
  row_version INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);
