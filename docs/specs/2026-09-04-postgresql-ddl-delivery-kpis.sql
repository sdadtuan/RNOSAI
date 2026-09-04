-- Wave D: project KPI attachments + PROJECT scope on Hub targets
ALTER TABLE crm_kpi_targets
  ADD COLUMN IF NOT EXISTS scope_project_id UUID REFERENCES crm_delivery_projects(id);

CREATE TABLE IF NOT EXISTS crm_delivery_project_kpis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES crm_delivery_projects(id),
  dictionary_id UUID NOT NULL,
  kpi_version_id UUID,
  target_id UUID,
  cycle TEXT NOT NULL DEFAULT 'MONTH' CHECK (cycle IN ('WEEK','MONTH')),
  owner_staff_id INT,
  baseline NUMERIC,
  warning_value NUMERIC,
  critical_value NUMERIC,
  inherit_alert BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  UNIQUE (project_id, dictionary_id) WHERE deleted_at IS NULL
);

CREATE INDEX IF NOT EXISTS crm_delivery_project_kpis_project_idx
  ON crm_delivery_project_kpis (project_id) WHERE deleted_at IS NULL;
