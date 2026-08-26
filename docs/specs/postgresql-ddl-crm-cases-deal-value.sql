-- Add deal_value_vnd to crm_cases (SQLite parity; used by staff workspace, sales, AI forecast).
ALTER TABLE crm_cases
  ADD COLUMN IF NOT EXISTS deal_value_vnd BIGINT NOT NULL DEFAULT 0;
