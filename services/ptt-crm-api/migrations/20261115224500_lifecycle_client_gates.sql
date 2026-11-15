-- Client approval gates for delivery (Kế hoạch, Go-live, Nghiệm thu).
-- Additive JSON on crm_service_lifecycle; revision history lives in the document
-- so phase 3 can read revision_count without a second table.
ALTER TABLE crm_service_lifecycle
  ADD COLUMN IF NOT EXISTS client_gates_json JSONB NOT NULL DEFAULT '{}'::jsonb;
