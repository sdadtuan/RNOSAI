CREATE TABLE IF NOT EXISTS sales_kit_files (
  id BIGSERIAL PRIMARY KEY,
  playbook_id UUID,
  lead_id INTEGER,
  session_id INTEGER,
  folder_key VARCHAR(191) NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  mime VARCHAR(127) NOT NULL,
  storage_key TEXT NOT NULL,
  parse_status VARCHAR(32) NOT NULL DEFAULT 'pending',
  parse_error TEXT,
  uploaded_by INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS sales_kit_files_folder_idx ON sales_kit_files (folder_key);
CREATE INDEX IF NOT EXISTS sales_kit_files_lead_idx ON sales_kit_files (lead_id, session_id);
