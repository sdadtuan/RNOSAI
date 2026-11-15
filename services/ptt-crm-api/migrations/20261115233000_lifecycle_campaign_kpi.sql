-- Phase 3: campaign KPI targets/actuals, ads/media cost, retain notes on service lifecycle
ALTER TABLE crm_service_lifecycle
  ADD COLUMN IF NOT EXISTS campaign_kpi_json JSONB NOT NULL DEFAULT '{}'::jsonb;
